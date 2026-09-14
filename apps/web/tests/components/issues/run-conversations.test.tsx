// @vitest-environment happy-dom
import { RunConversations } from "@web/components/issues/workspace/run-conversations";
import { act, type ReactNode } from "react";
import { expect, it, vi } from "vitest";

import { mount } from "#support/mount";
import { runContract } from "#support/run";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ params, children }: { params: { runId: string }; children: ReactNode }) => (
    <a href={`/runs/${params.runId}`}>{children}</a>
  ),
}));
vi.mock("@web/components/issues/workspace/conversation-section", () => ({
  ConversationSection: ({ runId, selectedStepId }: { runId: string; selectedStepId: string }) => (
    <div data-conversation={runId} data-step={selectedStepId} />
  ),
}));

it("shows the followed conversation first and keeps older runs reachable", async () => {
  const follow = vi.fn();
  const view = await mount(
    <RunConversations
      runs={[runContract({ id: "older", branch: "old-work" }), runContract({ id: "followed" })]}
      followedRunId="followed"
      selectedStepId="step-2"
      onFollow={follow}
      onSelectStep={vi.fn()}
    />,
  );
  try {
    const first = view.container;
    expect(first?.querySelector('[data-conversation="followed"]')?.getAttribute("data-step")).toBe(
      "step-2",
    );
    expect(document.querySelector('a[href="/runs/older"]')).toBeNull();
    await act(async () =>
      view.container.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click(),
    );
    expect(document.querySelector('a[href="/runs/older"]')).not.toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>("li button")?.click());
    expect(follow).toHaveBeenCalledWith("older");
  } finally {
    await view.cleanup();
  }
});
