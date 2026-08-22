import { z } from "zod";

import { eventEnvelopeSchema } from "../events/envelope.js";

/** One bounded page of a run's ledger, ascending by `seq`; without a cursor it is the newest page. */
export const runEventWindowSchema = z.object({
  run_id: z.string(),
  events: z.array(eventEnvelopeSchema),
  /** Pass as `before` to read the page just above this one; null once the ledger's start is loaded. */
  older_cursor: z.number().int().nonnegative().nullable(),
});
export type RunEventWindow = z.infer<typeof runEventWindowSchema>;

export const stepEventWindowSchema = runEventWindowSchema.extend({
  step_run_id: z.string(),
});
export type StepEventWindow = z.infer<typeof stepEventWindowSchema>;

export const runEndPayloadSchema = z.object({ status: z.string() });
export type RunEndPayload = z.infer<typeof runEndPayloadSchema>;

export const runStreamErrorPayloadSchema = z.object({ message: z.string() });
export type RunStreamErrorPayload = z.infer<typeof runStreamErrorPayloadSchema>;
