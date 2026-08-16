import { scriptFailure } from "../bootstrap/status.js";
import { GH_MISSING, artifactName } from "../instances/scripts.js";
import type { runSshScript } from "../ssh/script.js";
import { lastToken } from "../ssh/tokens.js";

const ARTIFACT_PREFIX = "OTOMAT_ARTIFACT:";
const PROBE_TIMEOUT_MS = 60_000;
const NO_ANSWER = "the artifact check reported nothing";

/** Only the workflow that publishes the bundle may answer for it; a tag release or a PR run cannot. */
const BUNDLE_WORKFLOW = "ci.yml";

/** A bundle that is not published *yet*: the CI for that commit still owes it. */
export type ArtifactPendingReason = "no_run" | "queued" | "in_progress" | "not_published";

/** What a bounded wait holds on: a CI state, or a probe that could not answer at all. */
export type ArtifactWaitReason = ArtifactPendingReason | "unreadable";

export type ArtifactAvailability =
  | { kind: "ready" }
  | { kind: "pending"; reason: ArtifactPendingReason }
  | { kind: "gh_missing" }
  | { kind: "query_failed"; detail: string }
  | { kind: "workflow_failed"; conclusion: string };

export interface ArtifactAvailabilityScriptOptions {
  build: string;
  repo: string;
}

export interface ArtifactProbeOptions extends ArtifactAvailabilityScriptOptions {
  alias: string;
  runScript: typeof runSshScript;
}

/** Reads only, and runs before anything is stopped, so a bundle CI still owes costs no restart. */
export async function probeArtifact(options: ArtifactProbeOptions): Promise<ArtifactAvailability> {
  const result = await options.runScript({
    alias: options.alias,
    script: artifactAvailabilityScript(options),
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  if (result.code !== 0) return { kind: "query_failed", detail: scriptFailure(result) };
  return parseArtifactAvailability(result.stdout) ?? { kind: "query_failed", detail: NO_ANSWER };
}

/**
 * An expired artifact stays listed with its content gone, so an id alone would report a bundle that
 * cannot be downloaded. Workflow runs are matched on a `head_sha` prefix because the API's own
 * filter takes the full sha, which an app stamped with a sha7 does not have.
 */
export function artifactAvailabilityScript(options: ArtifactAvailabilityScriptOptions): string {
  const jq = `first(.workflow_runs[] | select(.head_sha | startswith("${options.build}")) | [.status, .conclusion // "none"] | join(":")) // "none"`;
  const runs = `repos/${options.repo}/actions/workflows/${BUNDLE_WORKFLOW}/runs?event=push&per_page=50`;
  return [
    "set -u",
    `NAME="${artifactName(options.build)}"`,
    "if ! command -v gh >/dev/null 2>&1; then",
    `  echo "${ARTIFACT_PREFIX}NO_GH:-"`,
    "  exit 0",
    "fi",
    'TMP="$(mktemp -d)"',
    "trap 'rm -rf \"$TMP\"' EXIT",
    `if ! ID="$(gh api "repos/${options.repo}/actions/artifacts?name=$NAME&per_page=100" --jq 'first(.artifacts[] | select(.expired | not) | .id)' 2>"$TMP/err")"; then`,
    `  echo "${ARTIFACT_PREFIX}QUERY_FAILED:$(tail -c 160 "$TMP/err" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    'if [ -n "$ID" ] && [ "$ID" != "null" ]; then',
    `  echo "${ARTIFACT_PREFIX}READY:$NAME"`,
    "  exit 0",
    "fi",
    `if ! RUN="$(gh api "${runs}" --jq '${jq}' 2>"$TMP/err")"; then`,
    `  echo "${ARTIFACT_PREFIX}QUERY_FAILED:$(tail -c 160 "$TMP/err" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    `echo "${ARTIFACT_PREFIX}WORKFLOW:$RUN"`,
    "",
  ].join("\n");
}

export function parseArtifactAvailability(stdout: string): ArtifactAvailability | null {
  const token = lastToken(stdout, ARTIFACT_PREFIX);
  if (token === null) return null;
  switch (token.kind) {
    case "READY":
      return token.detail === "" ? null : { kind: "ready" };
    case "NO_GH":
      return { kind: "gh_missing" };
    case "QUERY_FAILED":
      return { kind: "query_failed", detail: token.detail.trim() };
    case "WORKFLOW":
      return workflowState(token.detail.trim());
    default:
      return null;
  }
}

function workflowState(reported: string): ArtifactAvailability {
  const [status, conclusion] = reported.split(":");
  if (status === "" || status === "none") return { kind: "pending", reason: "no_run" };
  if (status !== "completed") {
    return { kind: "pending", reason: status === "in_progress" ? "in_progress" : "queued" };
  }
  if (conclusion === "success") return { kind: "pending", reason: "not_published" };
  return { kind: "workflow_failed", conclusion: conclusion ?? "none" };
}

export function describeArtifactWait(reason: ArtifactWaitReason): string {
  switch (reason) {
    case "no_run":
      return "no CI run has appeared for this build yet";
    case "queued":
      return "its CI run is queued";
    case "in_progress":
      return "its CI run is still running";
    case "not_published":
      return "its CI run is green; the bundle is still being uploaded";
    case "unreadable":
      return "the host could not reach GitHub Actions";
  }
}

export function describeArtifactTimeout(reason: ArtifactPendingReason, build: string): string {
  const run = `the CI run for build ${build}`;
  switch (reason) {
    case "no_run":
      return `GitHub reports no CI run for build ${build}. Check the workflow on GitHub, then install again once its bundle is published.`;
    case "queued":
    case "in_progress":
      return `${run} did not publish its bundle in time. Check the workflow on GitHub, then install again.`;
    case "not_published":
      return `${run} finished without publishing ${artifactName(build)}. Re-run its daemon-bundle job, then install again.`;
  }
}

export function describeArtifactFailure(
  outcome: Exclude<ArtifactAvailability, { kind: "ready" } | { kind: "pending" }>,
  build: string,
): string {
  switch (outcome.kind) {
    case "gh_missing":
      return GH_MISSING;
    case "query_failed":
      return `the host could not ask GitHub Actions about build ${build}: ${outcome.detail}`;
    case "workflow_failed":
      return `the CI run for build ${build} ended as ${outcome.conclusion}, so no bundle was published. Re-run it on GitHub, then install again.`;
  }
}
