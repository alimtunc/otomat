import { spawnSync } from "node:child_process";

import type { ProbeStatus } from "@otomat/domain";

import { providerProcessEnv } from "#runtime/cli/environment";

const PROBE_TIMEOUT_MS = 10_000;
const PROBE_MAX_BUFFER = 16 * 1024 * 1024;
const DETAIL_MAX_LENGTH = 200;

/** Argument-parser refusals: this provider version has no such listing, which is a capability answer, not a failure. */
const UNSUPPORTED_MARKERS = [
  "unrecognized subcommand",
  "unexpected argument",
  "invalid subcommand",
  "unknown command",
  "unknown option",
  "is not a valid",
];

export type ProbeResult =
  | { status: "ok"; stdout: string }
  | { status: Exclude<ProbeStatus, "ok">; detail: string };

export function firstMeaningfulLine(text: string): string {
  const line = text.split("\n").find((candidate) => candidate.trim().length > 0) ?? "";
  return line.trim().slice(0, DETAIL_MAX_LENGTH);
}

function classifyFailure(stderr: string, exitCode: number | null): ProbeResult {
  const detail = firstMeaningfulLine(stderr) || `exited with code ${String(exitCode)}`;
  const unsupported = UNSUPPORTED_MARKERS.some((marker) =>
    stderr.toLowerCase().includes(marker.toLowerCase()),
  );
  return { status: unsupported ? "unsupported" : "failed", detail };
}

/** Runs a provider's own listing or help command: it never inspects credentials or configuration homes, and any non-zero exit becomes an honest unsupported/failed answer instead of a guess. */
export function probeProviderCommand(binary: string, args: readonly string[]): ProbeResult {
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    env: providerProcessEnv(),
    timeout: PROBE_TIMEOUT_MS,
    maxBuffer: PROBE_MAX_BUFFER,
  });

  if (result.error) return { status: "failed", detail: result.error.message };
  if (result.signal !== null) {
    return { status: "failed", detail: `probe stopped by signal ${result.signal}` };
  }
  if (result.status !== 0) return classifyFailure(result.stderr ?? "", result.status);
  return { status: "ok", stdout: result.stdout ?? "" };
}
