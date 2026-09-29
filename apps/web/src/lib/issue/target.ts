import type { IssueSummary } from "@otomat/domain";
import { interactionAnchor } from "@web/lib/run/interaction";

export function issueTarget(issue: Pick<IssueSummary, "id" | "execution">) {
  const target = { to: "/issues/$issueId" as const, params: { issueId: issue.id } };
  const { execution } = issue;
  if (execution.state !== "awaiting_input" || execution.request === null) return target;
  return {
    ...target,
    search: { run: execution.run_id, step: execution.request.step_run_id },
    hash: interactionAnchor(execution.request.id),
  };
}
