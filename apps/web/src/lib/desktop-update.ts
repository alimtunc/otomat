import type { DesktopUpdateSnapshot, DesktopUpdateState } from "@otomat/domain";

/** States the operator has something to do about, or that are working right now. */
const ACTIVE: ReadonlySet<DesktopUpdateState> = new Set<DesktopUpdateState>([
  "available",
  "downloading",
  "ready",
  "waiting_for_runs",
  "failed",
]);

export function isDesktopUpdateActive(state: DesktopUpdateState): boolean {
  return ACTIVE.has(state);
}

export function desktopUpdateHeadline(snapshot: DesktopUpdateSnapshot): string {
  const version = snapshot.release?.version ?? null;
  switch (snapshot.state) {
    case "checking":
      return "Checking for updates…";
    case "available":
      return `Otomat ${version ?? "update"} is available`;
    case "downloading":
      return `Downloading Otomat ${version ?? "update"}${
        snapshot.progress === null ? "" : ` — ${String(snapshot.progress)}%`
      }`;
    case "ready":
      return `Otomat ${version ?? "update"} is ready to install`;
    case "waiting_for_runs":
      return `Otomat ${version ?? "update"} is waiting for this workspace to be idle`;
    case "failed":
      return "The update stopped, and nothing was replaced";
    case "manual_only":
      return "This build does not replace itself";
    case "up_to_date":
      return snapshot.checked_at === null
        ? "Not checked for updates yet"
        : `Otomat ${snapshot.current_version} is up to date`;
  }
}
