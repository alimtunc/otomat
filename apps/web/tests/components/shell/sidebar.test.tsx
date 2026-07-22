// @vitest-environment happy-dom
import { Sidebar } from "@web/components/shell/sidebar";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
// happy-dom has no Web Animations API; Base UI's ScrollArea polls it after mount.
Object.assign(Element.prototype, { getAnimations: (): Animation[] => [] });

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

describe("Sidebar", () => {
  it("passes the active id and reactive selection callback to the switcher", async () => {
    const onProjectSelect = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Sidebar
          active="issues"
          online
          projects={[{ id: "local-default", name: "Local workspace" }]}
          currentProjectId="local-default"
          onProjectSelect={onProjectSelect}
          onSearch={vi.fn()}
          onNewIssue={vi.fn()}
        />,
      );
    });
    cleanups.push(async () => {
      await act(async () => root.unmount());
    });

    const trigger = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Switch project"]',
    );
    expect(trigger?.textContent).toContain("Local workspace");
    expect(trigger?.getAttribute("role")).toBe("combobox");

    await act(async () => {
      trigger?.click();
    });

    const item = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) =>
      element.textContent?.includes("Local workspace"),
    );
    expect(item).toBeDefined();
    await act(async () => {
      item?.click();
    });

    expect(onProjectSelect).toHaveBeenCalledWith("local-default");
  });
});
