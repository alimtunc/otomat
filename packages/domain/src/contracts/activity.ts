import { z } from "zod";

import { RUN_STATES } from "./entity-states.js";
import { operationContractSchema } from "./operation.js";

/** Where an activity is shown, ordered as the panel reads it top to bottom. */
export const ACTIVITY_BUCKETS = ["running", "queued", "attention", "recent"] as const;
export type ActivityBucket = (typeof ACTIVITY_BUCKETS)[number];

const activityIssueSchema = z.object({
  id: z.string().min(1),
  /** The tracker's own identifier; null for a local issue that has none. */
  identifier: z.string().nullable(),
  title: z.string(),
});

const activityProjectSchema = z.object({ id: z.string().min(1), name: z.string() });

const activityShape = {
  id: z.string().min(1),
  bucket: z.enum(ACTIVITY_BUCKETS),
  project: activityProjectSchema,
  issue: activityIssueSchema,
  /** Every activity is anchored on the run that owns the workspace it works in. */
  run_id: z.string().min(1),
  /** What the daemon recorded this activity as doing, never an invented estimate; null when it reports none. */
  phase: z.string().nullable(),
  updated_at: z.iso.datetime(),
};

export const activityContractSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("run"),
    status: z.enum(RUN_STATES),
    ...activityShape,
  }),
  z.object({
    kind: z.literal("pull_request_publication"),
    operation: operationContractSchema,
    ...activityShape,
  }),
]);
export type ActivityContract = z.infer<typeof activityContractSchema>;

/** Everything the connected host is working on, across its projects. */
export const activitySnapshotSchema = z.object({
  activities: z.array(activityContractSchema),
  /** When the host projected this; the panel dates its stale data with it once the host stops answering. */
  observed_at: z.iso.datetime(),
});
export type ActivitySnapshot = z.infer<typeof activitySnapshotSchema>;
