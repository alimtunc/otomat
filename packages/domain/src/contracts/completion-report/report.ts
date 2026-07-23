import { z } from "zod";

import { reportLinearSchema, reportPullRequestSchema, reportReviewSchema } from "./delivery.js";
import { evidencedMessageSchema } from "./evidence.js";
import {
  reportCommandSchema,
  reportDiffSchema,
  reportPlanSchema,
  reportRunSchema,
  reportStepSchema,
} from "./execution.js";

export const runCompletionReportSchema = z
  .object({
    version: z.literal(1),
    run: reportRunSchema,
    plan: reportPlanSchema,
    steps: z.array(reportStepSchema),
    diff: reportDiffSchema,
    commands: z.array(reportCommandSchema),
    review: reportReviewSchema,
    pull_request: reportPullRequestSchema,
    linear: reportLinearSchema,
    errors: z.array(evidencedMessageSchema),
    notices: z.array(evidencedMessageSchema),
    next_actions: z.array(evidencedMessageSchema),
  })
  .strict();
export type RunCompletionReport = z.infer<typeof runCompletionReportSchema>;

export const runCompletionReportResponseSchema = z
  .object({
    report: runCompletionReportSchema,
    markdown: z.string(),
  })
  .strict();
export type RunCompletionReportResponse = z.infer<typeof runCompletionReportResponseSchema>;
