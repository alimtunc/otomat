import type { RunDetail } from "@otomat/domain";
import { AgentAvatar, resolveStatus } from "@otomat/ui";
import { PaneHeader } from "@web/components/runs/cockpit/pane-header";
import { TONE_DOT, TONE_TEXT } from "@web/lib/status-tone";

export function StepsPane({ detail }: { detail: RunDetail }) {
  return (
    <div className="min-h-0 min-w-0 overflow-auto border-r border-border-subtle bg-sidebar">
      <PaneHeader className="bg-sidebar">Steps &amp; sessions</PaneHeader>
      <div className="py-1.5">
        {detail.steps.map((step, i) => {
          const meta = resolveStatus("step", step.status);
          const sessions = detail.sessions.filter((s) => s.step_run_id === step.id);
          return (
            <div
              key={step.id}
              className={
                i < detail.steps.length - 1
                  ? "border-b border-border-subtle px-3.5 py-1.75"
                  : "px-3.5 py-1.75"
              }
            >
              <div className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="inline-block h-1.75 w-1.75 flex-none rounded-full"
                  style={{ background: TONE_DOT[meta.tone] }}
                />
                <span className="font-medium text-foreground">{step.name}</span>
                <span className={`ml-auto text-xs ${TONE_TEXT[meta.tone]}`}>{meta.label}</span>
              </div>
              {sessions.length > 0 ? (
                <div className="mb-0.5 mt-1.5 ml-5.5 flex flex-col gap-0.75">
                  {sessions.map((session) => {
                    const sessionMeta = resolveStatus("session", session.status);
                    return (
                      <div
                        key={session.id}
                        className="flex h-7 items-center gap-2 rounded-md px-2 text-sm text-foreground"
                      >
                        <AgentAvatar size="sm" name={session.agent_id ?? "agent"} />
                        <span className="truncate">{session.agent_id ?? "agent"}</span>
                        <span className="ml-auto text-[10px] text-text-tertiary">
                          {sessionMeta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
