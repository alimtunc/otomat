import { isRunPlanCompeteGroup, type RunDetail } from "@otomat/domain";
import { stepDependencyNames } from "@web/lib/run-plan";

import { CompeteGroupRow } from "./compete-group-row";
import { DependencyNote, StepRow } from "./step-row";

export function StepsList({ detail }: { detail: RunDetail }) {
  const multiNode = detail.run.plan_json.steps.length > 1;
  return (
    <div className="py-1.5">
      {detail.run.plan_json.steps.map((node, nodeIndex) => {
        const dependencies = stepDependencyNames(detail.run.plan_json, node.id);
        const number = multiNode ? nodeIndex + 1 : undefined;
        if (isRunPlanCompeteGroup(node)) {
          return (
            <CompeteGroupRow
              key={node.id}
              detail={detail}
              node={node}
              number={number}
              dependencies={dependencies}
            />
          );
        }

        const step = detail.steps.find((entry) => entry.id === node.id);
        if (!step) return null;
        return (
          <div key={node.id} className="border-b border-border-subtle last:border-b-0">
            <StepRow detail={detail} step={step} number={number} />
            <DependencyNote
              names={dependencies}
              className="mb-2 ml-9 truncate text-xs text-text-tertiary"
            />
          </div>
        );
      })}
    </div>
  );
}
