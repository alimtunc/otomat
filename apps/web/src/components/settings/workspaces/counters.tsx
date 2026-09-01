import type { WorkspaceCounts, WorkspaceState } from "@otomat/domain";
import { Chip, cn, FOCUS_RING } from "@otomat/ui";
import { WORKSPACE_COUNTED_STATES, WORKSPACE_STATE } from "@web/lib/workspace/state";

export interface WorkspaceCountersProps {
  counts: WorkspaceCounts;
  selected: WorkspaceState[];
  onToggle: (state: WorkspaceState) => void;
}

export function WorkspaceCounters({ counts, selected, onToggle }: WorkspaceCountersProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {WORKSPACE_COUNTED_STATES.map((state) => {
        const active = selected.includes(state);
        if (counts[state] === 0 && !active) return null;
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
    </div>
  );
}
