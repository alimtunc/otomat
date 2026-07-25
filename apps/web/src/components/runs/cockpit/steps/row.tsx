import type { RunDetail, StepRunContract } from "@otomat/domain";
import { AgentAvatar, Badge, cn, Icon, LiveDot, resolveStatus, TONE_TEXT } from "@otomat/ui";

function SessionRows({ detail, step }: { detail: RunDetail; step: StepRunContract }) {
  const sessions = detail.sessions.filter((session) => session.step_run_id === step.id);
  if (sessions.length === 0) return null;

  return (
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
  );
}

export function StepRow({
  detail,
  step,
  number,
  winner,
  nested = false,
}: {
  detail: RunDetail;
  step: StepRunContract;
  number?: number;
  winner?: boolean;
  nested?: boolean;
}) {
  const meta = resolveStatus("step", step.status);
  return (
    <div className={cn("py-1.75", nested ? "ml-5 border-l border-border-strong pl-2.5" : "px-3.5")}>
      <div className="flex items-center gap-2 text-sm">
        {number ? (
          <span className="w-3.5 text-right text-xs font-semibold text-text-tertiary">
            {number}
          </span>
        ) : null}
        <LiveDot tone={meta.tone} live={meta.live} size={7} />
        <span className="truncate font-medium text-foreground">{step.name}</span>
        {winner ? (
          <Badge variant="iris" icon={<Icon name="git-compare" aria-hidden />}>
            winner
          </Badge>
        ) : null}
        <span className={`ml-auto text-xs lowercase ${TONE_TEXT[meta.tone]}`}>{meta.label}</span>
      </div>
      <SessionRows detail={detail} step={step} />
    </div>
  );
}

export function DependencyNote({ names, className }: { names: string[]; className: string }) {
  if (names.length === 0) return null;
  return <p className={className}>after {names.join(", ")}</p>;
}
