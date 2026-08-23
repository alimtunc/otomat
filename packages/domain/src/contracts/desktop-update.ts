export const DESKTOP_UPDATE_STATES = [
  "up_to_date",
  "checking",
  "available",
  "downloading",
  "ready",
  "waiting_for_runs",
  "failed",
  "manual_only",
] as const;
export type DesktopUpdateState = (typeof DESKTOP_UPDATE_STATES)[number];

export function isDesktopUpdateInstallable(state: DesktopUpdateState): boolean {
  return state === "ready" || state === "waiting_for_runs";
}

export type DesktopUpdateFeed = "stable" | "prerelease";

export interface DesktopUpdateRelease {
  version: string;
  /** Empty, never null, when the release carries none. */
  notes: string;
  released_at: string | null;
}

export interface DesktopUpdateSnapshot {
  state: DesktopUpdateState;
  current_version: string;
  feed: DesktopUpdateFeed;
  release: DesktopUpdateRelease | null;
  /** Whole percent downloaded, while downloading; null in every other state. */
  progress: number | null;
  checked_at: string | null;
  /** The blocking host, the failure, or why this build cannot replace itself. */
  detail: string | null;
  /** Set only when the app cannot install one itself. */
  manual_url: string | null;
}
