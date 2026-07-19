import { isRunPlanCompeteGroup, type RunDetail, type StepRunContract } from "@otomat/domain";
import { AgentAvatar, Badge, cn, Icon, LiveDot, resolveStatus, TONE_TEXT } from "@otomat/ui";
import { PaneHeader } from "@web/components/runs/pane-header";
import { stepDependencyNames } from "@web/lib/run-plan";

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

function StepRow({
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

export function StepsPane({ detail }: { detail: RunDetail }) {
  const multiNode = detail.run.plan_json.steps.length > 1;
  return (
    <div className="min-h-0 min-w-0 overflow-auto border-r border-border-subtle bg-sidebar">
      <PaneHeader className="bg-sidebar">Steps &amp; sessions</PaneHeader>
      <div className="py-1.5">
        {detail.run.plan_json.steps.map((node, nodeIndex) => {
          const dependencies = stepDependencyNames(detail.run.plan_json, node.id);
          if (!isRunPlanCompeteGroup(node)) {
            const step = detail.steps.find((entry) => entry.id === node.id);
            if (!step) return null;
            return (
              <div key={node.id} className="border-b border-border-subtle last:border-b-0">
                <StepRow
                  detail={detail}
                  step={step}
                  number={multiNode ? nodeIndex + 1 : undefined}
                />
                {dependencies.length > 0 ? (
                  <p className="mb-2 ml-9 truncate text-xs text-text-tertiary">
                    after {dependencies.join(", ")}
                  </p>
                ) : null}
              </div>
            );
          }

          const group = detail.compete_groups.find((entry) => entry.id === node.id);
          if (!group) return null;
          const groupMeta = resolveStatus("compete", group.status);
          return (
            <div
              key={node.id}
              className="border-b border-border-subtle px-3.5 py-2 last:border-b-0"
            >
              <div className="flex items-center gap-2 text-sm">
                {multiNode ? (
                  <span className="w-3.5 text-right text-xs font-semibold text-text-tertiary">
                    {nodeIndex + 1}
                  </span>
                ) : null}
                <LiveDot tone={groupMeta.tone} live={groupMeta.live} size={7} />
                <Icon name="git-compare" aria-hidden className="h-3.5 w-3.5 text-iris-text" />
                <span className="truncate font-semibold text-foreground">{group.name}</span>
                <span className={`ml-auto text-xs lowercase ${TONE_TEXT[groupMeta.tone]}`}>
                  {groupMeta.label}
                </span>
              </div>
              {dependencies.length > 0 ? (
                <p className="mt-0.5 ml-5.5 truncate text-xs text-text-tertiary">
                  after {dependencies.join(", ")}
                </p>
              ) : null}
              <div className="mt-1">
                {node.compete.map((candidate) => {
                  const step = detail.steps.find((entry) => entry.id === candidate.id);
                  return step ? (
                    <StepRow
                      key={step.id}
                      detail={detail}
                      step={step}
                      nested
                      winner={group.winner_step_run_id === step.id}
                    />
                  ) : null;
                })}
              </div>
              {group.status === "awaiting_selection" ? (
                <p className="mt-1.5 rounded bg-warning-bg px-2 py-1.5 text-[10px] leading-4 text-warning">
                  Dependent steps wait for the winner.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
