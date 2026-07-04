import { z } from "zod";

import {
  agentSessionContractSchema,
  runContractSchema,
  stepRunContractSchema,
} from "./entities.js";

/** Daemon liveness/identity surface served at `GET /api/health`. */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  name: z.string(),
  version: z.string(),
  started_at: z.iso.datetime(),
  db_path: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** A run plus its persisted step/session graph; the event ledger is served by the run's SSE stream, not here. */
export const runDetailSchema = z.object({
  run: runContractSchema,
  steps: z.array(stepRunContractSchema),
  sessions: z.array(agentSessionContractSchema),
});
export type RunDetail = z.infer<typeof runDetailSchema>;

/** Launch a run from an existing issue or from an ad-hoc local prompt. At least one is required. */
export const startRunRequestSchema = z
  .object({
    issue_id: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.issue_id) || Boolean(value.prompt), {
    message: "Provide either issue_id or prompt",
  });
export type StartRunRequest = z.infer<typeof startRunRequestSchema>;

/** Terminal payload of a run's SSE stream: the run's final status once the ledger is drained. */
export const runEndPayloadSchema = z.object({ status: z.string() });
export type RunEndPayload = z.infer<typeof runEndPayloadSchema>;

/** Terminal payload when a run's SSE stream fails server-side before the run ends; the consumer should stop and surface it. */
export const runStreamErrorPayloadSchema = z.object({ message: z.string() });
export type RunStreamErrorPayload = z.infer<typeof runStreamErrorPayloadSchema>;
