import { z } from "zod";

import { contextFileSchema } from "./file.js";
import { contextIssueSchema } from "./issue.js";
import { CONTEXT_NOTE_MAX_LENGTH } from "./limits.js";
import { contextReviewCommentSchema } from "./review.js";

/** Resolved to content once and frozen in the plan, so a resume replays these values instead of reading the tracker again. */
export const contextSelectionSchema = z.object({
  captured_at: z.iso.datetime(),
  /** The run's own issue; null only for a run that has none. */
  issue: contextIssueSchema.nullable(),
  /** In the order they were attached. */
  issues: z.array(contextIssueSchema).default([]),
  files: z.array(contextFileSchema).default([]),
  /** Comments a fix step was asked to address; empty on every other step. */
  review_comments: z.array(contextReviewCommentSchema).default([]),
  note: z.string().max(CONTEXT_NOTE_MAX_LENGTH).nullable().default(null),
});
export type ContextSelection = z.infer<typeof contextSelectionSchema>;
