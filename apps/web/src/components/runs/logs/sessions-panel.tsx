import type { RunDetail } from "@otomat/domain";
import { SessionRow } from "@web/components/runs/logs/session-row";
import { PaneHeader } from "@web/components/runs/pane-header";

export function SessionsPanel({ detail }: { detail: RunDetail }) {
  return (
    <section className="flex-none border-b border-border-subtle">
      <PaneHeader>
        Sessions
        <span className="ml-auto font-mono text-micro font-normal normal-case">
          {detail.sessions.length}
        </span>
      </PaneHeader>
      {detail.sessions.length === 0 ? (
        <p className="px-3.5 py-2.5 text-xs text-text-tertiary">
          No agent sessions yet. Sessions appear when a runtime starts.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {detail.sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              worktreePath={detail.worktree_path}
              stepName={detail.steps.find((step) => step.id === session.step_run_id)?.name ?? null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
