// @vitest-environment happy-dom
import { CockpitTabs } from "@web/components/runs/cockpit/tabs";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mount } from "#support/mount";

interface LinkMockProps extends ComponentPropsWithoutRef<"a"> {
  to: string;
  params?: Record<string, string>;
  children?: ReactNode;
}

let currentRoute: string | null = null;
const queriedRoutes: string[] = [];

vi.mock("@tanstack/react-router", () => ({
  useMatchRoute: () => (opts: { to: string }) => {
    queriedRoutes.push(opts.to);
    return opts.to === currentRoute;
  },
  Link: ({ to, params: _params, children, ...rest }: LinkMockProps) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

function pressedTabLabel(container: HTMLElement): string | null {
  return container.querySelector("[data-pressed]")?.textContent ?? null;
}

afterEach(() => {
  currentRoute = null;
  queriedRoutes.length = 0;
});

describe("CockpitTabs", () => {
  it("renders link tabs as anchors without native button semantics", async () => {
    const { container, cleanup } = await mount(<CockpitTabs runId="run-1" />);

    const anchors = [...container.querySelectorAll("a")];
    expect(anchors.map((anchor) => anchor.textContent)).toEqual(["Timeline", "Logs", "Diff", "PR"]);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    for (const anchor of anchors) {
      expect(anchor.hasAttribute("type")).toBe(false);
    }

    await cleanup();
  });

  it("marks the matched child route active, unshadowed by the index route", async () => {
    currentRoute = "/runs/$runId/logs";
    const { container, cleanup } = await mount(<CockpitTabs runId="run-1" />);
    expect(pressedTabLabel(container)).toBe("Logs");
    await cleanup();
  });

  it("marks the index route active from its own match, not the fallback", async () => {
    currentRoute = "/runs/$runId";
    const { container, cleanup } = await mount(<CockpitTabs runId="run-1" />);
    expect(pressedTabLabel(container)).toBe("Timeline");
    expect(queriedRoutes).toContain("/runs/$runId");
    expect(queriedRoutes).not.toContain("/runs/$runId/pr");
    await cleanup();
  });

  it("falls back to the timeline tab on a cockpit URL that matches no tab", async () => {
    currentRoute = null;
    const { container, cleanup } = await mount(<CockpitTabs runId="run-1" />);
    expect(pressedTabLabel(container)).toBe("Timeline");
    expect(queriedRoutes).toContain("/runs/$runId/pr");
    await cleanup();
  });
});
