import { z } from "zod";

import { changeStatusSchema } from "../diff.js";
import { RUN_STATES, STEP_RUN_STATES } from "../entity-states.js";
import { reportEvidenceSchema } from "./evidence.js";

export const reportRunSchema = z
  .object({
    id: z.string(),
    issue_id: z.string(),
    branch: z.string(),
    status: z.enum(RUN_STATES),
    outcome: z.enum(["succeeded", "failed", "canceled", "interrupted", "in_progress"]),
    terminal: z.boolean(),
    evidence: reportEvidenceSchema,
  })
  .strict();

export const reportPlanSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("reported"),
      step_count: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      state: z.literal("corrupt"),
      step_count: z.null(),
    })
    .strict(),
]);

export const reportStepSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    status: z.enum(STEP_RUN_STATES),
    runtime: z.string().nullable(),
    provider_sessions: z.array(z.string()),
    evidence: reportEvidenceSchema,
  })
  .strict();

const reportDiffFileSchema = z
  .object({
    path: z.string(),
    status: changeStatusSchema,
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
    evidence: reportEvidenceSchema,
  })
  .strict();

export const reportDiffSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("reported"),
      sha: z.string(),
      additions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
      files: z.array(reportDiffFileSchema).nonempty(),
      evidence: reportEvidenceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("no_changes"),
      sha: z.string(),
      additions: z.literal(0),
      deletions: z.literal(0),
      files: z.tuple([]),
      evidence: reportEvidenceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("not_reported"),
      sha: z.null(),
      additions: z.null(),
      deletions: z.null(),
      files: z.tuple([]),
      evidence: reportEvidenceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("unavailable"),
      sha: z.null(),
      additions: z.null(),
      deletions: z.null(),
      files: z.tuple([]),
      evidence: reportEvidenceSchema,
    })
    .strict(),
]);

export const reportCommandSchema = z
  .object({
    id: z.string(),
    command: z.string().min(1),
    kind: z.enum(["command", "test"]),
    outcome: z.enum(["running", "completed", "passed", "failed"]),
    exit_code: z.number().int().nullable(),
    evidence: reportEvidenceSchema,
  })
  .strict();
