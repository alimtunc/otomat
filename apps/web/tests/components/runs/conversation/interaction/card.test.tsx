// @vitest-environment happy-dom
import type { RuntimeInteractionQuestion } from "@otomat/domain";
import { InteractionCard } from "@web/components/runs/conversation/interaction/card";
import { act, createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { setTextareaValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { interaction } from "#support/interaction";
import { mount, type Mounted } from "#support/mount";

const answer = vi.fn();
const mutation = { mutate: answer, isPending: false, isError: false, error: null, reset: vi.fn() };

vi.mock("@web/api/runs/interaction-mutations", () => ({
  useAnswerRunInteraction: () => mutation,
}));

let ui: Mounted;

beforeEach(() => {
  answer.mockReset();
});

afterEach(async () => {
  await ui.cleanup();
});

function card(overrides: Parameters<typeof interaction>[0] = {}) {
  return createElement(InteractionCard, { runId: "run-1", interaction: interaction(overrides) });
}

function question(overrides: Partial<RuntimeInteractionQuestion> = {}): RuntimeInteractionQuestion {
  return {
    prompt: "Which branch should I target?",
    options: [
      { value: "main", label: "main", description: "The default branch." },
      { value: "develop", label: "develop", description: null },
    ],
    select: "single",
    allows_custom: false,
    ...overrides,
  };
}

/** An option button reads as its label followed by the description the runtime attached to it. */
const MAIN = "mainThe default branch.";

function choice(overrides: Partial<RuntimeInteractionQuestion> = {}) {
  return card({
    kind: "choice",
    prompt: "Which branch should I target?",
    tool: null,
    questions: [question(overrides)],
  });
}

it("offers approve and refuse for a permission, and sends the decision the operator picked", async () => {
  ui = await mount(card());

  expect(findButton("Approve")).toBeDefined();
  findButton("Refuse")?.click();

  expect(answer).toHaveBeenCalledWith({ kind: "permission", decision: "deny" });
});

it("shows the runtime's own reason for asking next to the question", async () => {
  ui = await mount(
    card({ reason: "grep on '.' would read '.env', which the deny rule Read(./.env) covers." }),
  );

  expect(ui.container.textContent).toContain("deny rule Read(./.env)");
});

it("offers the runtime's own options for a choice, never an approval, and keeps a single pick to one", async () => {
  ui = await mount(choice());

  expect(findButton("Approve")).toBeUndefined();
  expect(ui.container.textContent).toContain("The default branch.");
  await act(async () => findButton(MAIN)?.click());
  await act(async () => findButton("develop")?.click());
  await act(async () => findButton("Send answer")?.click());

  expect(answer).toHaveBeenCalledWith({ kind: "choice", values: ["develop"] });
});

it("keeps every option a multi-select question was given", async () => {
  ui = await mount(choice({ select: "multiple" }));

  await act(async () => findButton(MAIN)?.click());
  await act(async () => findButton("develop")?.click());
  await act(async () => findButton("Send answer")?.click());

  expect(answer).toHaveBeenCalledWith({ kind: "choice", values: ["main", "develop"] });
});

it("opens a written answer only when the runtime allows one, and sends what was typed", async () => {
  ui = await mount(choice());
  expect(findButton("Other")).toBeUndefined();
  await ui.cleanup();

  ui = await mount(choice({ allows_custom: true }));
  await act(async () => findButton("Other")?.click());
  const field = document.querySelector("textarea");
  if (field === null) throw new Error("expected the answer field");
  await act(async () => setTextareaValue(field, "  release/2  "));
  await act(async () => findButton("Send answer")?.click());

  expect(answer).toHaveBeenCalledWith({ kind: "choice", values: ["release/2"] });
});

it("submits every question of a questionnaire together, and explains what is still missing", async () => {
  ui = await mount(
    card({
      kind: "questionnaire",
      prompt: "Branch · Scope",
      tool: null,
      questions: [
        question(),
        question({
          prompt: "How far should I go?",
          options: [
            { value: "minimal", label: "minimal", description: null },
            { value: "thorough", label: "thorough", description: null },
          ],
        }),
      ],
    }),
  );

  await act(async () => findButton(MAIN)?.click());
  expect(findButton("Send answer")?.disabled).toBe(true);
  expect(ui.container.textContent).toContain("still needs an answer");

  await act(async () => findButton("thorough")?.click());
  await act(async () => findButton("Send answer")?.click());

  expect(answer).toHaveBeenCalledWith({
    kind: "questionnaire",
    responses: [
      { question: "Which branch should I target?", values: ["main"] },
      { question: "How far should I go?", values: ["thorough"] },
    ],
  });
});

it("offers a written answer for a text question and sends what was typed", async () => {
  ui = await mount(
    card({
      kind: "text",
      prompt: "Which release note applies?",
      tool: null,
      questions: [
        question({ prompt: "Which release note applies?", options: [], allows_custom: true }),
      ],
    }),
  );
  const field = document.querySelector("textarea");
  if (field === null) throw new Error("expected the answer field");

  await act(async () => setTextareaValue(field, "  ship it  "));
  await act(async () => findButton("Send answer")?.click());

  expect(answer).toHaveBeenCalledWith({ kind: "text", text: "ship it" });
});

it("shows the settled answer instead of controls once the question is answered", async () => {
  ui = await mount(card({ state: "answered", answer: { kind: "permission", decision: "allow" } }));

  expect(findButton("Approve")).toBeUndefined();
  expect(ui.container.textContent).toContain("You answered: Approved");
});

it("explains why a question can no longer be answered rather than offering a dead control", async () => {
  ui = await mount(
    card({
      state: "canceled",
      canceled_reason: "The turn that asked this question is no longer running.",
    }),
  );

  expect(findButton("Approve")).toBeUndefined();
  expect(ui.container.textContent).toContain("no longer running");
});
