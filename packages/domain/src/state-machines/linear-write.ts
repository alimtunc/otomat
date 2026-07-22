import { defineMachine } from "./machine.js";

/**
 * Lifecycle of one persisted Linear write attempt. A row is inserted `pending`
 * before the provider call, moves to `sending` while the mutation is in flight,
 * then `sent` on confirmation or `failed` on a bounded error. A `sending` (or
 * never-dispatched `pending`) row found after a crash is reconciled to `failed`,
 * which is the only retryable state — retries are always explicit.
 */
export const LINEAR_WRITE_STATES = ["pending", "sending", "sent", "failed"] as const;

export type LinearWriteState = (typeof LINEAR_WRITE_STATES)[number];

export const linearWriteMachine = defineMachine<LinearWriteState>({
  name: "linear_write",
  initial: "pending",
  transitions: {
    pending: ["sending", "failed"],
    sending: ["sent", "failed"],
    sent: [],
    failed: ["sending"],
  },
});
