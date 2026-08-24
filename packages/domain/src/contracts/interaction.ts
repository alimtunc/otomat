import { z } from "zod";

import { runInteractionContractSchema } from "./entities/runs.js";
import { runtimeInteractionAnswerSchema } from "./runtime.js";

/** A run's runtime interactions, oldest request first. */
export const runInteractionsResponseSchema = z.object({
  run_id: z.string(),
  interactions: z.array(runInteractionContractSchema),
});
export type RunInteractionsResponse = z.infer<typeof runInteractionsResponseSchema>;

/** The single answer command; its `kind` must match the request's, so an answer can never be read as one for another question. */
export const answerRunInteractionRequestSchema = z
  .object({ answer: runtimeInteractionAnswerSchema })
  .strict();
export type AnswerRunInteractionRequest = z.infer<typeof answerRunInteractionRequestSchema>;

/** Why an answer was refused; `run_interaction_unreachable` keeps a dead turn's request visible while saying the provider can no longer take it. */
export const ANSWER_RUN_INTERACTION_ERRORS = [
  "run_interaction_not_found",
  "run_interaction_kind_mismatch",
  "run_interaction_answered",
  "run_interaction_unreachable",
] as const;
export type AnswerRunInteractionError = (typeof ANSWER_RUN_INTERACTION_ERRORS)[number];

export const answerRunInteractionErrorSchema = z.object({
  error: z.enum(ANSWER_RUN_INTERACTION_ERRORS),
  message: z.string().min(1),
});
