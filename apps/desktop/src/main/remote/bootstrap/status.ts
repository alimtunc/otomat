import type { RemoteHostStatus } from "@otomat/domain";

import type { SshScriptResult } from "../ssh/script.js";
import { parseBootstrapOutput } from "./scripts.js";

export type RemoteErrorStatus = RemoteHostStatus & { phase: "error" };

export function trimDetail(text: string): string {
  return text.trim().split(/\r?\n/).slice(-3).join(" · ").slice(0, 300);
}

export type BootstrapResolution = { failure: RemoteErrorStatus } | { detail: string };

/** Turns one start-or-verify round trip into either a typed failure or the running-daemon detail. */
export function resolveBootstrapResult(result: SshScriptResult): BootstrapResolution {
  if (result.code !== 0) {
    return {
      failure: {
        phase: "error",
        code: "ssh_unreachable",
        detail: trimDetail(result.stderr) || `ssh exited with code ${String(result.code)}`,
      },
    };
  }
  const outcome = parseBootstrapOutput(result.stdout);
  if (outcome === null) {
    return {
      failure: {
        phase: "error",
        code: "daemon_start_failed",
        detail: trimDetail(result.stderr) || "The start-or-verify script reported nothing.",
      },
    };
  }
  switch (outcome.kind) {
    case "start_failed":
      return {
        failure: {
          phase: "error",
          code: "daemon_start_failed",
          detail: trimDetail(outcome.logTail),
        },
      };
    case "daemon_missing":
      return { failure: { phase: "error", code: "daemon_missing", detail: outcome.entry } };
    case "node_missing":
      return { failure: { phase: "error", code: "node_missing", detail: null } };
    case "node_too_old":
      return { failure: { phase: "error", code: "node_too_old", detail: outcome.version } };
    case "running":
    case "started":
      return { detail: `daemon ${outcome.kind} (pid ${outcome.pid})` };
  }
}
