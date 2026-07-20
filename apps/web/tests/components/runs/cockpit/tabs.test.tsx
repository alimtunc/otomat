// @vitest-environment happy-dom
import { CockpitTabs } from "@web/components/runs/cockpit/tabs";
import { act, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

interface LinkMockProps extends ComponentPropsWithoutRef<"a"> {
  to: string;
  params?: Record<string, string>;
  children?: ReactNode;
}

vi.mock("@tanstack/react-router", () => ({
  useMatchRoute: () => () => false,
  Link: ({ to, params: _params, children, ...rest }: LinkMockProps) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("CockpitTabs", () => {
  it("renders link tabs as anchors without native button semantics", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<CockpitTabs runId="run-1" />);
    });

    const anchors = [...container.querySelectorAll("a")];
    expect(anchors.map((anchor) => anchor.textContent)).toEqual(["Timeline", "Logs", "Diff", "PR"]);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    for (const anchor of anchors) {
      expect(anchor.hasAttribute("type")).toBe(false);
    }

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
