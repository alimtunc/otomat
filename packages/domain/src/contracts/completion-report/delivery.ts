import { z } from "zod";

import {
  LINEAR_WRITE_STATES,
  PULL_REQUEST_PUBLICATION_STATES,
  PULL_REQUEST_STATES,
} from "../entity-states.js";
import { linearWriteKindSchema } from "../linear.js";
import { reportEvidenceSchema } from "./evidence.js";

const reportOpenCommentSchema = z
  .object({
    id: z.string(),
    file_path: z.string(),
    line: z.number().int().nonnegative(),
    body: z.string(),
    evidence: reportEvidenceSchema,
  })
  .strict();

export const reportReviewSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("not_reported"),
      total_comments: z.literal(0),
      open_comments: z.tuple([]),
      evidence: reportEvidenceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("open"),
      total_comments: z.number().int().positive(),
      open_comments: z.array(reportOpenCommentSchema).nonempty(),
      evidence: reportEvidenceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("resolved"),
      total_comments: z.number().int().nonnegative(),
      open_comments: z.tuple([]),
      evidence: reportEvidenceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("unavailable"),
      total_comments: z.literal(0),
      open_comments: z.tuple([]),
      evidence: reportEvidenceSchema,
    })
    .strict(),
]);

export const reportPullRequestSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("not_reported"),
      number: z.null(),
      url: z.null(),
      status: z.null(),
      publication_status: z.null(),
      error: z.null(),
      evidence: reportEvidenceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("reported"),
      number: z.number().int().positive().nullable(),
      url: z.url().nullable(),
      status: z.enum(PULL_REQUEST_STATES),
      publication_status: z.enum(PULL_REQUEST_PUBLICATION_STATES),
      error: z.string().nullable(),
      evidence: reportEvidenceSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("unavailable"),
      number: z.null(),
      url: z.null(),
      status: z.null(),
      publication_status: z.null(),
      error: z.null(),
      evidence: reportEvidenceSchema,
    })
    .strict(),
]);

const reportLinearWriteSchema = z
  .object({
    id: z.string(),
    kind: linearWriteKindSchema,
    status: z.enum(LINEAR_WRITE_STATES),
    detail: z.string().nullable(),
    error: z.string().nullable(),
    evidence: reportEvidenceSchema,
  })
  .strict();

export const reportLinearSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("not_reported"), writes: z.tuple([]) }).strict(),
  z
    .object({ state: z.literal("reported"), writes: z.array(reportLinearWriteSchema).nonempty() })
    .strict(),
  z.object({ state: z.literal("unavailable"), writes: z.tuple([]) }).strict(),
]);
