import type { WorkspaceState } from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

export interface WorkspaceStateDescriptor {
  label: string;
  tone: StatusTone;
}

export const WORKSPACE_STATE: Record<WorkspaceState, WorkspaceStateDescriptor> = {
  active: { label: "Active", tone: "iris" },
  cleanup_required: { label: "Cleanup required", tone: "warning" },
  stale: { label: "Stale", tone: "stale" },
  missing: { label: "Missing", tone: "stale" },
  unmanaged: { label: "Unmanaged", tone: "ghost" },
  removed: { label: "Cleaned", tone: "neutral" },
};

/** `removed` is history, not work, so it is neither counted nor offered as a filter. */
export const WORKSPACE_COUNTED_STATES = [
  "active",
  "cleanup_required",
  "stale",
  "missing",
  "unmanaged",
] as const satisfies readonly WorkspaceState[];
