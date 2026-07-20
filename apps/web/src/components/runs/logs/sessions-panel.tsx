import type { AgentSessionContract, RunDetail } from "@otomat/domain";
import { AgentAvatar, CopyButton, StatusChip } from "@otomat/ui";
import { PaneHeader } from "@web/components/runs/pane-header";

function SessionRow({
  session,
  stepName,
}: {
  session: AgentSessionContract;
  stepName: string | null;
}) {
  return (
    <li className="flex h-9 items-center gap-2.5 px-3.5 text-sm">
      <AgentAvatar size="sm" name={session.agent_id ?? "agent"} />
      <span className="truncate font-medium text-foreground">{session.agent_id ?? "agent"}</span>
      {stepName !== null ? (
        <span className="truncate text-xs text-text-tertiary">{stepName}</span>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        {session.provider_session_id !== null ? (
          <span className="flex items-center gap-1 font-mono text-[10px] text-text-tertiary">
            <span className="max-w-40 truncate" title={session.provider_session_id}>
              {session.provider_session_id}
            </span>
            <CopyButton value={session.provider_session_id} label="Copy provider session id" />
          </span>
        ) : null}
        <StatusChip kind="session" status={session.status} />
      </span>
    </li>
  );
}

/** The run's agent sessions as persisted by the daemon; never inferred from the stream. */
export function SessionsPanel({ detail }: { detail: RunDetail }) {
  return (
    <section className="flex-none border-b border-border-subtle">
      <PaneHeader>
        Sessions
        <span className="ml-auto font-mono text-[10px] font-normal normal-case">
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
              stepName={detail.steps.find((step) => step.id === session.step_run_id)?.name ?? null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
