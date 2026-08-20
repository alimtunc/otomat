import { z } from "zod";

const OPERATION_KINDS = ["pull_request_publication"] as const;

/** `interrupted` is a daemon that stopped mid-operation, told apart from a failure the work itself produced. */
const OPERATION_STATES = ["running", "succeeded", "interrupted", "failed"] as const;
export type OperationState = (typeof OPERATION_STATES)[number];

const OPERATION_PHASE_STATES = ["pending", "active", "done", "failed"] as const;
export type OperationPhaseState = (typeof OPERATION_PHASE_STATES)[number];

const operationPhaseSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  state: z.enum(OPERATION_PHASE_STATES),
});
export type OperationPhase = z.infer<typeof operationPhaseSchema>;

/** The stable reference a client re-reads after navigating, reconnecting or restarting, with the phases the daemon has reached. */
export const operationContractSchema = z.object({
  id: z.string(),
  kind: z.enum(OPERATION_KINDS),
  state: z.enum(OPERATION_STATES),
  phases: z.array(operationPhaseSchema),
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }).nullable(),
  /** Whether re-issuing the same command is safe; a running operation is never retried, only awaited. */
  retryable: z.boolean(),
  updated_at: z.iso.datetime(),
});
export type OperationContract = z.infer<typeof operationContractSchema>;
