import type { RunDetail } from "@otomat/domain";
import { AgentAvatar, cn, LiveDot, resolveStatus, TONE_TEXT } from "@otomat/ui";
import { PaneHeader } from "@web/components/runs/pane-header";
import { stepDependencyNames } from "@web/lib/run-plan";

export function StepsPane({ detail }: { detail: RunDetail }) {
  const multiStep = detail.steps.length > 1;
  return (
    <div className="min-h-0 min-w-0 overflow-auto border-r border-border-subtle bg-sidebar">
      <PaneHeader className="bg-sidebar">Steps &amp; sessions</PaneHeader>
      <div className="py-1.5">
        {detail.steps.map((step, i) => {
          const meta = resolveStatus("step", step.status);
          const sessions = detail.sessions.filter((s) => s.step_run_id === step.id);
          const dependencies = stepDependencyNames(detail.run.plan_json, step.id);
          return (
            <div
              key={step.id}
              className={cn(
                "px-3.5 py-1.75",
                i < detail.steps.length - 1 && "border-b border-border-subtle",
              )}
            >
              <div className="flex items-center gap-2 text-sm">
                {multiStep ? (
                  <span className="w-3.5 text-right text-xs font-semibold text-text-tertiary">
                    {step.idx + 1}
                  </span>
                ) : null}
                <LiveDot tone={meta.tone} live={meta.live} size={7} />
                <span className="truncate font-medium text-foreground">{step.name}</span>
                <span className={`ml-auto text-xs lowercase ${TONE_TEXT[meta.tone]}`}>
                  {meta.label}
                </span>
              </div>
              {dependencies.length > 0 ? (
                <p
                  className={cn(
                    "mt-0.5 truncate text-xs text-text-tertiary",
                    multiStep && "ml-5.5",
                  )}
                >
                  after {dependencies.join(", ")}
                </p>
              ) : null}
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
                        <span className="ml-auto text-[10px] lowercase text-text-tertiary">
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
