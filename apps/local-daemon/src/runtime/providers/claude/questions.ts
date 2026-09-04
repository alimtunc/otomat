import type {
  RuntimeInteractionAnswer,
  RuntimeInteractionOption,
  RuntimeInteractionQuestion,
  RuntimeInteractionRequest,
} from "@otomat/domain";

import { asArray, asRecord, asString } from "#runtime/cli/frame-guards";

/** The contract takes no blank prompt, label or description, so a blank one reads as absent instead of as a request nothing can record. */
function written(value: unknown): string | null {
  const text = asString(value);
  return text === null || text.trim().length === 0 ? null : text;
}

/** Claude Code keys its answers by the option's own label, so the label is the value Otomat sends back. */
function toOption(raw: unknown): RuntimeInteractionOption | null {
  const option = asRecord(raw);
  const label = written(option?.["label"]);
  if (option === null || label === null) return null;
  return { value: label, label, description: written(option["description"]) };
}

function toQuestion(raw: unknown): RuntimeInteractionQuestion | null {
  const question = asRecord(raw);
  const prompt = written(question?.["question"]);
  if (question === null || prompt === null) return null;
  const options = asArray(question["options"]).map(toOption);
  if (options.some((option) => option === null)) return null;
  return {
    prompt,
    options: options.filter((option) => option !== null),
    select: question["multiSelect"] === true ? "multiple" : "single",
    // The CLI supplies the "Other" affordance itself, so each of its questions takes an answer outside the options it listed.
    allows_custom: true,
  };
}

interface ClaudeQuestionAsk {
  prompt: string;
  questions: RuntimeInteractionQuestion[];
}

/** Null for anything that is not the question tool's input, so an unrecognised ask stays the binary gate it was. */
function claudeQuestionAsk(input: unknown): ClaudeQuestionAsk | null {
  const raw = asArray(asRecord(input)?.["questions"]);
  if (raw.length === 0) return null;
  const questions = raw.map(toQuestion);
  if (questions.some((question) => question === null)) return null;
  const asked = questions.filter((question) => question !== null);
  const headers = raw.map((entry) => written(asRecord(entry)?.["header"]));
  const prompt =
    asked.length === 1 || headers.some((header) => header === null)
      ? asked.map((question) => question.prompt).join(" · ")
      : headers.join(" · ");
  return { prompt, questions: asked };
}

/** Claude keys its `answers` map by the question text, and takes a multi-select as one comma-joined string. */
export function claudeAnsweredInput(
  toolInput: unknown,
  answer: RuntimeInteractionAnswer,
): Record<string, unknown> | null {
  const input = asRecord(toolInput);
  if (input === null) return null;
  const asked = claudeQuestionAsk(input);
  if (asked === null) return null;
  if (answer.kind === "choice") {
    const question = asked.questions[0];
    if (question === undefined) return null;
    return { ...input, answers: { [question.prompt]: answer.values.join(", ") } };
  }
  if (answer.kind !== "questionnaire") return null;
  const answers: Record<string, string> = {};
  for (const response of answer.responses) {
    answers[response.question] = response.values.join(", ");
  }
  return { ...input, answers };
}

/** What one `can_use_tool` control request asks for: the CLI flags a question it needs answered rather than an action it needs cleared. */
export function claudeAskShape(
  request: Record<string, unknown>,
  toolName: string,
): Pick<RuntimeInteractionRequest, "kind" | "prompt" | "questions"> {
  const asked =
    request["requires_user_interaction"] === true ? claudeQuestionAsk(request["input"]) : null;
  if (asked !== null) {
    return {
      kind: asked.questions.length > 1 ? "questionnaire" : "choice",
      prompt: asked.prompt,
      questions: asked.questions,
    };
  }
  const detail = written(request["description"]);
  return {
    kind: "permission",
    prompt: detail === null ? `Run ${toolName}?` : `Run ${toolName}: ${detail}`,
    questions: [],
  };
}
