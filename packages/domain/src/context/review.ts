import { z } from "zod";

export const contextReviewCommentSchema = z.object({
  id: z.string(),
  file_path: z.string(),
  /** Null for a whole-file comment. */
  line: z.number().int().nullable(),
  body: z.string(),
  /** Diff the comment was pinned to, so the evidence stays checkable after the branch moves. */
  diff_sha: z.string(),
  /** Empty for a whole-file comment. */
  hunk: z.string(),
  /** Null when the path no longer exists at capture time. */
  current_file: z.string().nullable(),
});
export type ContextReviewComment = z.infer<typeof contextReviewCommentSchema>;
