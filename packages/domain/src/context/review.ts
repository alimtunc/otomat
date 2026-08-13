import { z } from "zod";

import { diffSideSchema } from "../contracts/diff.js";

export const contextReviewCommentSchema = z.object({
  id: z.string(),
  file_path: z.string(),
  /** Null for a whole-file comment. */
  line: z.number().int().nullable(),
  /** First line of a multi-line anchor; null when the comment stands on `line` alone. */
  start_line: z.number().int().nullable().default(null),
  side: diffSideSchema.default("new"),
  body: z.string(),
  /** Replacement for exactly the anchored lines, so the agent applies it instead of inferring one. */
  suggestion: z.string().nullable().default(null),
  /** The lines that replacement stands against, as the pinned diff showed them. */
  suggestion_original: z.string().nullable().default(null),
  /** Diff the comment was pinned to, so the evidence stays checkable after the branch moves. */
  diff_sha: z.string(),
  /** Empty for a whole-file comment. */
  hunk: z.string(),
  /** Null when the path no longer exists at capture time. */
  current_file: z.string().nullable(),
});
export type ContextReviewComment = z.infer<typeof contextReviewCommentSchema>;
