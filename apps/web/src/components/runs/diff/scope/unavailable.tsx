import { EmptyState } from "@otomat/ui";
import { useSelector } from "@tanstack/react-store";
import { RunDiffHeader } from "@web/components/runs/diff/header";
import { diffPrefsStore } from "@web/components/runs/diff/prefs/store";
import { CenteredState } from "@web/components/shell/centered-state";
import type { ReactNode } from "react";

export interface DiffScopeUnavailableProps {
  scopeControl: ReactNode;
  /** The daemon's own sentence for why this slice could not be reconstructed. */
  reason: string | null;
}

export function DiffScopeUnavailable({ scopeControl, reason }: DiffScopeUnavailableProps) {
  const prefs = useSelector(diffPrefsStore);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <RunDiffHeader
        diff={null}
        scopeControl={scopeControl}
        reviewStatus={null}
        prefs={prefs}
        onPrefsChange={diffPrefsStore.actions.set}
        browsable={false}
        reviewedCount={0}
        activePath={null}
      />
      <CenteredState>
        <EmptyState
          icon="git-compare"
          title="No diff for this scope"
          description={
            reason ?? "The daemon reported no diff for this scope. Diffs are never fabricated."
          }
        />
      </CenteredState>
    </div>
  );
}
