import type { PreviewProbe } from "@web/preview/probe";

export type PreviewBlockedCause =
  | { kind: "build_mismatch"; daemonBuild: string | null }
  | { kind: "unreadable"; detail: string };

export type PreviewSessionState =
  | { state: "sandbox"; reason: "unavailable" | "starting" }
  | { state: "live" }
  | { state: "blocked"; cause: PreviewBlockedCause };

/**
 * A reachable instance on another commit blocks instead of degrading: its API and this bundle
 * disagree, and a sandbox would hide that behind fixtures that always work.
 */
export function previewSessionState(build: string, probe: PreviewProbe): PreviewSessionState {
  switch (probe.kind) {
    case "ready":
      return probe.build === build
        ? { state: "live" }
        : { state: "blocked", cause: { kind: "build_mismatch", daemonBuild: probe.build } };
    case "unreadable":
      return { state: "blocked", cause: { kind: "unreadable", detail: probe.detail } };
    default:
      return { state: "sandbox", reason: probe.kind };
  }
}
