import { z } from "zod";

import { pullRequestProvenanceSchema } from "./entities/pull-request.js";

/**
 * One thing genuinely waiting for a line-by-line review: a run resting on its
 * own diff, or an adopted pull request. A merged or closed pull request is
 * absent from this list, which is what takes it out of the sidebar count without
 * touching any history.
 */
export const reviewQueueEntrySchema = z.object({
  kind: z.enum(["run", "pull_request"]),
  /** Run id or pull request id — the key of the review surface this entry opens. */
  id: z.string(),
  issue_id: z.string(),
  label: z.string().min(1),
  /** Head branch under review; null when the pull request never reported one. */
  branch: z.string().nullable(),
  /** Null for a run; a pull request always states whose branch it ships. */
  provenance: pullRequestProvenanceSchema.nullable(),
});
export type ReviewQueueEntry = z.infer<typeof reviewQueueEntrySchema>;

/** Which review surface a call addresses; the daemon mounts one identical surface under each. */
export interface ReviewTarget {
  kind: ReviewQueueEntry["kind"];
  id: string;
}
