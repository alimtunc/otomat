import { getIssue, type RunRow } from "@otomat/db";
import type { PullRequestDraft } from "@otomat/domain";
import { z } from "zod";

import { GitHubPublicationError } from "./errors.js";
import type {
  CommandRunner,
  GitHubServiceConfig,
  PullRequestDrafter,
  PullRequestDraftInput,
} from "./types.js";

const PATCH_BUDGET_CHARS = 40_000;
const DRAFT_TIMEOUT_MS = 180_000;

const draftOutputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(10_000),
  branch: z.string().trim().min(1).max(80),
});

/** Git-safe kebab slug of the model's proposal; null when nothing survives. */
export function sanitizeBranchName(raw: string): string | null {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/(^[-/.]+)|([-/.]+$)/g, "")
    .slice(0, 60)
    .replace(/(^[-/.]+)|([-/.]+$)/g, "");
  if (slug === "" || slug.startsWith("otomat/run")) return null;
  return slug;
}

function draftPrompt(input: PullRequestDraftInput): string {
  const patch =
    input.patch.length > PATCH_BUDGET_CHARS
      ? `${input.patch.slice(0, PATCH_BUDGET_CHARS)}\n… (patch truncated)`
      : input.patch;
  return [
    "Draft the GitHub pull request for the change below.",
    "",
    `Objective:\n${input.objective}`,
    "",
    `Changed files:\n${input.diffStat.join("\n")}`,
    "",
    `Patch:\n${patch}`,
    "",
    "Answer with ONLY one JSON object — no prose, no code fences — of this exact shape:",
    '{"title": "…", "body": "…", "branch": "…"}',
    "- title: imperative mood, at most 72 characters",
    "- body: GitHub markdown — one-paragraph summary, then bullet points of the key changes",
    "- branch: kebab-case git branch such as feat/short-name or fix/short-name, at most 50 characters",
  ].join("\n");
}

/** Last JSON object in the output; print-mode CLIs occasionally wrap it in stray text. */
function extractJson(stdout: string): unknown {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new GitHubPublicationError("pr_draft_invalid", "The agent returned no JSON draft.");
  }
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    throw new GitHubPublicationError("pr_draft_invalid", "The agent's draft was not valid JSON.");
  }
}

/** One-shot, tool-less invocations per runtime; only entries listed here can draft. */
const DRAFT_COMMANDS: Record<string, { command: string; args: string[] }> = {
  claude: { command: "claude", args: ["-p", "--output-format", "text"] },
};

export function buildPullRequestDraftInput(
  config: Pick<GitHubServiceConfig, "db" | "repositories">,
  run: RunRow,
): PullRequestDraftInput {
  const service = config.repositories.forRun(run.id)?.service;
  const worktree = service?.get(run.id);
  if (service === undefined || worktree === undefined) {
    throw new GitHubPublicationError(
      "pr_draft_failed",
      "The run has no repository worktree to describe.",
    );
  }
  const diff = service.diff(run.id);
  if (diff.files.length === 0) {
    throw new GitHubPublicationError("pr_draft_failed", "The run has no changes to describe.");
  }
  const issueTitle = getIssue(config.db, run.issue_id)?.title ?? null;
  const firstPrompt = run.plan_json.steps.find((step) => "prompt" in step)?.prompt ?? null;
  const objective =
    [issueTitle, firstPrompt].filter(Boolean).join("\n") || "No objective recorded.";
  return {
    runtime: run.agent_id ?? "",
    cwd: worktree.path,
    objective,
    diffStat: diff.files.map((file) => `${file.path} +${file.additions} -${file.deletions}`),
    patch: diff.files.map((file) => file.patch).join("\n"),
  };
}

export function createPullRequestDrafter(run: CommandRunner): PullRequestDrafter {
  return {
    async draft(input: PullRequestDraftInput): Promise<PullRequestDraft> {
      const invocation = DRAFT_COMMANDS[input.runtime];
      if (invocation === undefined) {
        throw new GitHubPublicationError(
          "pr_draft_unsupported_runtime",
          `The ${input.runtime} runtime has no draft mode yet — write the title and description by hand.`,
        );
      }
      const result = await run({
        command: invocation.command,
        args: invocation.args,
        cwd: input.cwd,
        stdin: draftPrompt(input),
        timeoutMs: DRAFT_TIMEOUT_MS,
      });
      if (result.errorCode === "timed_out") {
        throw new GitHubPublicationError(
          "pr_draft_failed",
          `The agent did not answer within ${String(DRAFT_TIMEOUT_MS / 1000)} seconds.`,
        );
      }
      if (result.exitCode !== 0 || result.errorCode) {
        const detail = result.stderr.trim().split("\n").at(-1) || (result.errorCode ?? "");
        throw new GitHubPublicationError(
          "pr_draft_failed",
          `The agent could not draft the pull request${detail === "" ? "." : ` (${detail.slice(0, 200)})`}`,
        );
      }
      const parsed = draftOutputSchema.safeParse(extractJson(result.stdout));
      if (!parsed.success) {
        throw new GitHubPublicationError(
          "pr_draft_invalid",
          "The agent's draft was missing a title, body, or branch.",
        );
      }
      const branch = sanitizeBranchName(parsed.data.branch);
      if (branch === null) {
        throw new GitHubPublicationError(
          "pr_draft_invalid",
          "The agent proposed an unusable branch name.",
        );
      }
      return { title: parsed.data.title, body: parsed.data.body, branch };
    },
  };
}
