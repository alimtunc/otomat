import type {
  RunInteractionContract,
  RuntimeInteractionAnswer,
  RuntimeInteractionQuestion,
} from "@otomat/domain";

/** One question's working state: the options ticked, plus the free answer written under "Other". */
export interface QuestionDraft {
  values: string[];
  other: boolean;
  custom: string;
}

/** A question the runtime listed no options for is a free answer, so its written value counts from the start. */
export function initialDrafts(questions: readonly RuntimeInteractionQuestion[]): QuestionDraft[] {
  return questions.map((question) => ({
    values: [],
    other: question.options.length === 0,
    custom: "",
  }));
}

export function draftToggled(
  draft: QuestionDraft,
  question: RuntimeInteractionQuestion,
  value: string,
): QuestionDraft {
  if (question.select === "single") return { ...draft, other: false, values: [value] };
  const values = draft.values.includes(value)
    ? draft.values.filter((candidate) => candidate !== value)
    : [...draft.values, value];
  return { ...draft, values };
}

export function draftOtherToggled(
  draft: QuestionDraft,
  question: RuntimeInteractionQuestion,
): QuestionDraft {
  if (draft.other) return { ...draft, other: false };
  return { ...draft, other: true, values: question.select === "single" ? [] : draft.values };
}

function draftValues(draft: QuestionDraft | undefined): string[] {
  if (draft === undefined) return [];
  const custom = draft.custom.trim();
  if (!draft.other || custom.length === 0) return draft.values;
  return [...draft.values, custom];
}

/** An incomplete draft still builds an answer: the shared validator is what refuses it, here and in the daemon. */
export function draftAnswer(
  interaction: Pick<RunInteractionContract, "kind" | "questions">,
  drafts: readonly QuestionDraft[],
): RuntimeInteractionAnswer {
  if (interaction.kind === "text") {
    return { kind: "text", text: (drafts[0]?.custom ?? "").trim() };
  }
  if (interaction.kind === "choice") {
    return { kind: "choice", values: draftValues(drafts[0]) };
  }
  return {
    kind: "questionnaire",
    responses: interaction.questions.map((question, index) => ({
      question: question.prompt,
      values: draftValues(drafts[index]),
    })),
  };
}
