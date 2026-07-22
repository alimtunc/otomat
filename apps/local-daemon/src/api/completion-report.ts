import { listAgentSessionsForRun, listStepRunsForRun, schema, type Db } from "@otomat/db";
import {
  runCompletionReportResponseSchema,
  runPlanSchema,
  type RunCompletionReport,
  type RunCompletionReportResponse,
} from "@otomat/domain";
import { eq } from "drizzle-orm";

import { readRunEventProjection } from "#events";
import type { ReviewService } from "#review";

import { collectReportedCommands } from "./completion-report/commands.js";
import { projectDelivery } from "./completion-report/delivery.js";
import { projectExecution } from "./completion-report/execution.js";
import { renderRunCompletionMarkdown } from "./completion-report/markdown.js";
import { appendReportMessages } from "./completion-report/messages.js";
import { projectReviewEvidence } from "./completion-report/review.js";

export function projectRunCompletionReport(
  db: Db,
  runId: string,
  review: ReviewService,
): RunCompletionReportResponse | null {
  const run = db.select().from(schema.runs).where(eq(schema.runs.id, runId)).get();
  if (!run) return null;

  const plan = runPlanSchema.safeParse(run.plan_json);
  const eventProjection = readRunEventProjection(db, runId);
  const sessions = listAgentSessionsForRun(db, runId);
  const errors: RunCompletionReport["errors"] = [];
  const notices: RunCompletionReport["notices"] = [];
  if (!plan.success) {
    notices.push({
      code: "plan_corrupt",
      message: "Persisted plan could not be read.",
      evidence: [],
    });
  }
  if (eventProjection.corruptEventCount > 0) {
    notices.push({
      code: "events_corrupt",
      message: `${eventProjection.corruptEventCount} persisted event(s) could not be read.`,
      evidence: [],
    });
  }

  const execution = projectExecution({
    db,
    run,
    steps: listStepRunsForRun(db, runId),
    sessions,
    events: eventProjection.events,
    notices,
  });
  const reviewEvidence = projectReviewEvidence({ runId: run.id, review, errors });
  const delivery = projectDelivery({ db, issueId: run.issue_id, runId: run.id, errors });
  const report: RunCompletionReport = {
    version: 1,
    run: execution.run,
    plan: plan.success
      ? { state: "reported", step_count: plan.data.steps.length }
      : { state: "corrupt", step_count: null },
    steps: execution.steps,
    diff: reviewEvidence.diff,
    commands: collectReportedCommands(eventProjection.events),
    review: reviewEvidence.review,
    pull_request: delivery.pull_request,
    linear: delivery.linear,
    errors,
    notices,
    next_actions: [],
  };
  appendReportMessages(report, sessions);
  return runCompletionReportResponseSchema.parse({
    report,
    markdown: renderRunCompletionMarkdown(report),
  });
}
