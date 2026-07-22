import type { RunDetail, RunPlanCompeteGroup } from "@otomat/domain";
import { Icon, LiveDot, resolveStatus, TONE_TEXT } from "@otomat/ui";

import { DependencyNote, StepRow } from "./step-row";

export function CompeteGroupRow({
  detail,
  node,
  number,
  dependencies,
}: {
  detail: RunDetail;
  node: RunPlanCompeteGroup;
  number?: number;
  dependencies: string[];
}) {
  const group = detail.compete_groups.find((entry) => entry.id === node.id);
  if (!group) return null;
  const groupMeta = resolveStatus("compete", group.status);

  return (
    <div className="border-b border-border-subtle px-3.5 py-2 last:border-b-0">
      <div className="flex items-center gap-2 text-sm">
        {number ? (
          <span className="w-3.5 text-right text-xs font-semibold text-text-tertiary">
            {number}
          </span>
        ) : null}
        <LiveDot tone={groupMeta.tone} live={groupMeta.live} size={7} />
        <Icon name="git-compare" aria-hidden className="h-3.5 w-3.5 text-iris-text" />
        <span className="truncate font-semibold text-foreground">{group.name}</span>
        <span className={`ml-auto text-xs lowercase ${TONE_TEXT[groupMeta.tone]}`}>
          {groupMeta.label}
        </span>
      </div>
      <DependencyNote
        names={dependencies}
        className="mt-0.5 ml-5.5 truncate text-xs text-text-tertiary"
      />
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
}
