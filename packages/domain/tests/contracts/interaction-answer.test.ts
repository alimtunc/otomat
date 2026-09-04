import { describe, expect, it } from "vitest";

import type {
  RunInteractionKind,
  RuntimeInteractionAnswer,
  RuntimeInteractionQuestion,
} from "#domain/contracts/index";
import { interactionAnswerRefusal } from "#domain/contracts/interaction";

function question(overrides: Partial<RuntimeInteractionQuestion> = {}): RuntimeInteractionQuestion {
  return {
    prompt: "Which branch should I target?",
    options: [
      { value: "main", label: "main", description: null },
      { value: "develop", label: "develop", description: null },
    ],
    select: "single",
    allows_custom: false,
    ...overrides,
  };
}

function refusal(
  kind: RunInteractionKind,
  questions: RuntimeInteractionQuestion[],
  answer: RuntimeInteractionAnswer,
): string | null {
  return interactionAnswerRefusal({ kind, questions }, answer)?.message ?? null;
}

describe("permission and text", () => {
  it("takes the decision a permission asks for and refuses an answer of another kind", () => {
    expect(refusal("permission", [], { kind: "permission", decision: "deny" })).toBeNull();
    expect(
      interactionAnswerRefusal(
        { kind: "permission", questions: [] },
        { kind: "choice", values: ["main"] },
      ),
    ).toEqual({
      error: "run_interaction_kind_mismatch",
      message: "This question takes a permission answer, not a choice one.",
    });
  });

  it("refuses a written answer that says nothing", () => {
    const asked = [question({ options: [], allows_custom: true })];
    expect(refusal("text", asked, { kind: "text", text: "ship it" })).toBeNull();
    expect(refusal("text", asked, { kind: "text", text: "   " })).toBe(
      "Write an answer before sending.",
    );
  });
});

describe("choice", () => {
  it("takes one option and refuses two when the runtime announced a single pick", () => {
    expect(refusal("choice", [question()], { kind: "choice", values: ["main"] })).toBeNull();
    expect(refusal("choice", [question()], { kind: "choice", values: ["main", "develop"] })).toBe(
      '"Which branch should I target?" takes exactly one answer.',
    );
  });

  it("takes several options only when the runtime announced a multiple pick", () => {
    const asked = [question({ select: "multiple" })];
    expect(refusal("choice", asked, { kind: "choice", values: ["main", "develop"] })).toBeNull();
  });

  it("refuses a value the runtime never offered unless it announced a custom answer", () => {
    expect(refusal("choice", [question()], { kind: "choice", values: ["release"] })).toBe(
      '"Which branch should I target?" only takes the options the runtime listed.',
    );
    expect(
      refusal("choice", [question({ allows_custom: true })], {
        kind: "choice",
        values: ["release"],
      }),
    ).toBeNull();
  });
});

describe("questionnaire", () => {
  const asked = [
    question(),
    question({ prompt: "How far should I go?", options: [], allows_custom: true }),
  ];

  it("takes one answer per question", () => {
    expect(
      refusal("questionnaire", asked, {
        kind: "questionnaire",
        responses: [
          { question: "Which branch should I target?", values: ["main"] },
          { question: "How far should I go?", values: ["all the way"] },
        ],
      }),
    ).toBeNull();
  });

  it("refuses a partial submission rather than sending half a questionnaire", () => {
    expect(
      refusal("questionnaire", asked, {
        kind: "questionnaire",
        responses: [{ question: "Which branch should I target?", values: ["main"] }],
      }),
    ).toBe('"How far should I go?" still needs an answer.');
  });

  it("refuses an answer to a question that was never asked, and a question answered twice", () => {
    expect(
      refusal("questionnaire", asked, {
        kind: "questionnaire",
        responses: [
          { question: "Which branch should I target?", values: ["main"] },
          { question: "How far should I go?", values: ["a"] },
          { question: "Something else?", values: ["b"] },
        ],
      }),
    ).toBe('"Something else?" is not one of the questions asked.');
    expect(
      refusal("questionnaire", asked, {
        kind: "questionnaire",
        responses: [
          { question: "Which branch should I target?", values: ["main"] },
          { question: "Which branch should I target?", values: ["develop"] },
        ],
      }),
    ).toBe("Each question takes one answer.");
  });
});
