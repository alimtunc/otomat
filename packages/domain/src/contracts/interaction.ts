import { z } from "zod";

import { runInteractionContractSchema, type RunInteractionContract } from "./entities/runs.js";
import {
  runtimeInteractionAnswerSchema,
  type RuntimeInteractionAnswer,
  type RuntimeInteractionQuestion,
  type RuntimeInteractionResponse,
} from "./runtime.js";

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
  "run_interaction_answer_invalid",
  "run_interaction_answered",
  "run_interaction_unreachable",
] as const;
export type AnswerRunInteractionError = (typeof ANSWER_RUN_INTERACTION_ERRORS)[number];

export const answerRunInteractionErrorSchema = z.object({
  error: z.enum(ANSWER_RUN_INTERACTION_ERRORS),
  message: z.string().min(1),
});

export interface InteractionAnswerRefusal {
  error: AnswerRunInteractionError;
  message: string;
}

function invalid(message: string): InteractionAnswerRefusal {
  return { error: "run_interaction_answer_invalid", message };
}

function questionRefusal(
  question: RuntimeInteractionQuestion,
  values: readonly string[],
): InteractionAnswerRefusal | null {
  if (values.length === 0) return invalid(`"${question.prompt}" still needs an answer.`);
  if (question.select === "single" && values.length !== 1) {
    return invalid(`"${question.prompt}" takes exactly one answer.`);
  }
  const offered = new Set(question.options.map((option) => option.value));
  if (!question.allows_custom && values.some((value) => !offered.has(value))) {
    return invalid(`"${question.prompt}" only takes the options the runtime listed.`);
  }
  return null;
}

function questionnaireRefusal(
  questions: readonly RuntimeInteractionQuestion[],
  responses: readonly RuntimeInteractionResponse[],
): InteractionAnswerRefusal | null {
  const answered = new Set(responses.map((response) => response.question));
  if (answered.size !== responses.length) return invalid("Each question takes one answer.");
  const unanswered = questions.find((question) => !answered.has(question.prompt));
  if (unanswered !== undefined) {
    return invalid(`"${unanswered.prompt}" still needs an answer.`);
  }
  for (const response of responses) {
    const question = questions.find((candidate) => candidate.prompt === response.question);
    if (question === undefined) {
      return invalid(`"${response.question}" is not one of the questions asked.`);
    }
    const refusal = questionRefusal(question, response.values);
    if (refusal !== null) return refusal;
  }
  return null;
}

/**
 * Whether the runtime would take this answer for that request, decided once for
 * the command that refuses it and the form that disables its own submit control.
 */
export function interactionAnswerRefusal(
  request: Pick<RunInteractionContract, "kind" | "questions">,
  answer: RuntimeInteractionAnswer,
): InteractionAnswerRefusal | null {
  if (answer.kind !== request.kind) {
    return {
      error: "run_interaction_kind_mismatch",
      message: `This question takes a ${request.kind} answer, not a ${answer.kind} one.`,
    };
  }
  if (answer.kind === "questionnaire") {
    return questionnaireRefusal(request.questions, answer.responses);
  }
  if (answer.kind === "text") {
    return answer.text.trim().length === 0 ? invalid("Write an answer before sending.") : null;
  }
  if (answer.kind === "permission") return null;
  const question = request.questions[0];
  if (question === undefined) return invalid("This request listed no options.");
  return questionRefusal(question, answer.values);
}
