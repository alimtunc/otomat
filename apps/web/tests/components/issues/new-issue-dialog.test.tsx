// @vitest-environment happy-dom
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const start = vi.fn(async () => false);

vi.mock("@web/api/runs/mutations", () => ({
  useStartRunAndNavigate: () => ({ start, isPending: false }),
}));

vi.mock("@web/components/runs/launch/runtime-select", () => ({
  RuntimeSelect: () => <div data-testid="runtime-select" />,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

describe("NewIssueDialog", () => {
  it("exposes only the working agent-backed issue flow", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<NewIssueDialog open onOpenChange={() => undefined} projectName="otomat" />);
    });
    cleanups.push(async () => {
      await act(async () => root.unmount());
    });

    const buttons = [...document.querySelectorAll("button")].map((button) => button.textContent);
    expect(buttons).not.toContain("Manual");
    expect(document.querySelector("textarea")).not.toBeNull();
    expect(document.body.textContent).toContain("Create & launch");
  });
});
