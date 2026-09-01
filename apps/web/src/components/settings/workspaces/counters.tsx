import type { WorkspaceCounts, WorkspaceState } from "@otomat/domain";
import { Chip, cn, FOCUS_RING } from "@otomat/ui";
import { WORKSPACE_COUNTED_STATES, WORKSPACE_STATE } from "@web/lib/workspace/state";

export interface WorkspaceCountersProps {
  counts: WorkspaceCounts;
  selected: WorkspaceState[];
  onToggle: (state: WorkspaceState) => void;
}

export function WorkspaceCounters({ counts, selected, onToggle }: WorkspaceCountersProps) {
  const empty = WORKSPACE_COUNTED_STATES.filter(
    (state) => counts[state] === 0 && !selected.includes(state),
  );
  const shown = WORKSPACE_COUNTED_STATES.filter((state) => !empty.includes(state));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((state) => {
        const active = selected.includes(state);
        return (
          <button
            key={state}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(state)}
            className={cn("rounded-sm", FOCUS_RING, active ? "ring-1 ring-border-strong" : null)}
          >
            <Chip tone={WORKSPACE_STATE[state].tone}>
              {WORKSPACE_STATE[state].label}
              <span className="font-mono">{counts[state]}</span>
            </Chip>
          </button>
        );
      })}
      {empty.length === 0 ? null : (
        <Chip tone="ghost" hint={empty.map((state) => WORKSPACE_STATE[state].label).join(", ")}>
          +{empty.length} empty {empty.length === 1 ? "state" : "states"}
        </Chip>
      )}
    </div>
  );
}
