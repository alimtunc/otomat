import type { Db, IssueSourceRow } from "@otomat/db";
import type { LinearLifecycleReconcileResult, LinearLifecycleSignal } from "@otomat/domain";

import { issueWorkspace } from "#supervisor";

import { listSourceIssues, sourceLifecycle } from "./lifecycle.js";

export async function reconcileSourceLifecycle(
  db: Db,
  source: IssueSourceRow,
  assert: (signal: LinearLifecycleSignal) => Promise<void>,
): Promise<LinearLifecycleReconcileResult> {
  if (sourceLifecycle(source).in_progress === null) return { reconciled: 0, failed: 0 };
  const pending: Promise<void>[] = [];
  for (const issue of listSourceIssues(db, source)) {
    const workspace = issueWorkspace(db, issue.id);
    if (workspace.state !== "open") continue;
    pending.push(assert({ issue_id: issue.id, phase: "in_progress", run_id: workspace.run_id }));
  }
  const settled = await Promise.allSettled(pending);
  const failed = settled.filter((outcome) => outcome.status === "rejected").length;
  return { reconciled: settled.length - failed, failed };
}
