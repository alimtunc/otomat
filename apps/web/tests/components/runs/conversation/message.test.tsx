// @vitest-environment happy-dom
import type { RunContributionContract } from "@otomat/domain";
import { ConversationMessage } from "@web/components/runs/conversation/message";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { contribution } from "#support/contribution";

const retryMutate = vi.fn();
const cancelMutate = vi.fn();

vi.mock("@web/api/runs/mutations", () => ({
  useRetryRunContribution: () => ({ mutate: retryMutate, isPending: false }),
  useCancelRunContribution: () => ({ mutate: cancelMutate, isPending: false }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  retryMutate.mockClear();
  cancelMutate.mockClear();
});

async function renderMessage(overrides: Partial<RunContributionContract>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<ConversationMessage runId="run-1" contribution={contribution(overrides)} />);
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
  });
}

function buttonLabelled(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label),
  );
}

it("offers to withdraw a message no turn has claimed, and withdraws that message", async () => {
  await renderMessage({ status: "queued" });

  const cancel = buttonLabelled("Cancel message");
  expect(cancel).toBeDefined();
  expect(buttonLabelled("Retry delivery")).toBeUndefined();

  await act(async () => cancel?.click());
  expect(cancelMutate).toHaveBeenCalledWith("c1");
});

it("offers both retry and withdrawal for a failure that never reached the agent", async () => {
  await renderMessage({ status: "failed", error: "spawn failed" });

  expect(buttonLabelled("Retry delivery")).toBeDefined();
  expect(buttonLabelled("Cancel message")).toBeDefined();
});

it("shows an unclaimed message as waiting for the next turn", async () => {
  await renderMessage({ status: "queued" });

  expect(document.body.textContent).toContain("Waiting for next turn");
});

it("shows a message a live turn claimed as on its way, not as still queued", async () => {
  await renderMessage({ status: "queued", agent_session_id: "as1" });

  expect(document.body.textContent).toContain("Sending");
});

it("offers neither once a turn is carrying the message", async () => {
  await renderMessage({
    status: "delivered",
    agent_session_id: "as1",
    delivered_at: "2026-07-25T10:01:00.000Z",
  });

  expect(buttonLabelled("Cancel message")).toBeUndefined();
  expect(buttonLabelled("Retry delivery")).toBeUndefined();
});

it("shows a message's images from the daemon next to its text, and alone when there is no text", async () => {
  await renderMessage({
    body: "what is wrong here",
    images: [
      { id: "img-1", media_type: "image/png", size_bytes: 10 },
      { id: "img-2", media_type: "image/jpeg", size_bytes: 20 },
    ],
  });

  const images = [...document.querySelectorAll<HTMLImageElement>("img")];
  expect(images.map((img) => img.alt)).toEqual(["Attachment 1", "Attachment 2"]);
  expect(images.map((img) => img.getAttribute("src"))).toEqual([
    "/api/runs/run-1/contributions/c1/images/img-1",
    "/api/runs/run-1/contributions/c1/images/img-2",
  ]);
  expect(document.body.textContent).toContain("what is wrong here");

  document.body.replaceChildren();
  await renderMessage({
    body: "",
    images: [{ id: "img-3", media_type: "image/png", size_bytes: 10 }],
  });
  expect(document.querySelectorAll("img")).toHaveLength(1);
});
