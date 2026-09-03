// @vitest-environment happy-dom
import { InteractionCard } from "@web/components/runs/conversation/interaction-card";
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

it("offers the runtime's own options for a choice, never an approval", async () => {
  ui = await mount(
    card({
      kind: "choice",
      prompt: "Which branch should I target?",
      tool: null,
      options: [
        { value: "main", label: "main" },
        { value: "develop", label: "develop" },
      ],
    }),
  );

  expect(findButton("Approve")).toBeUndefined();
  findButton("develop")?.click();

  expect(answer).toHaveBeenCalledWith({ kind: "choice", values: ["develop"] });
});

it("offers a written answer for a text question and sends what was typed", async () => {
  ui = await mount(card({ kind: "text", prompt: "Which release note applies?", tool: null }));
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
