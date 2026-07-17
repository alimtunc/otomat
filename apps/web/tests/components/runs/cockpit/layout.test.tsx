// @vitest-environment happy-dom
import { RunCockpitLayout } from "@web/components/runs/cockpit/layout";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div>outlet</div>,
  useParams: () => ({ runId: "run-1" }),
}));

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () => ({ data: undefined }),
}));

vi.mock("@web/api/runs/run-events-provider", () => ({
  RunEventsProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@web/components/runs/cockpit/tabs", () => ({
  CockpitTabs: () => <div>tabs</div>,
}));

vi.mock("@web/components/shell/route-shell", () => ({
  RouteShell: ({ active, children }: { active: string; children: ReactNode }) => (
    <div data-active-section={active}>{children}</div>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("RunCockpitLayout", () => {
  it("activates the Runs section for run routes", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<RunCockpitLayout />);
    });

    expect(
      container.querySelector("[data-active-section]")?.getAttribute("data-active-section"),
    ).toBe("runs");

    await act(async () => root.unmount());
    container.remove();
  });
});
