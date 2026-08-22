// @vitest-environment happy-dom
import { Sidebar } from "@web/components/shell/sidebar";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubAnimations } from "#support/animations";
import { findButton } from "#support/dom-queries";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
stubAnimations();

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

async function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
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
        onProjectSelect={vi.fn()}
        onOpenSettings={vi.fn()}
        onSearch={vi.fn()}
        onNewIssue={vi.fn()}
        {...overrides}
      />,
    );
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
  });
  return container;
}

function switcherTrigger(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('button[aria-label="Switch project"]');
}

describe("Sidebar", () => {
  it("passes the active id and reactive selection callback to the switcher", async () => {
    const onProjectSelect = vi.fn();
    await renderSidebar({ onProjectSelect });

    const trigger = switcherTrigger();
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

  it("keeps only the working surfaces, leaving configuration and reference to Settings", async () => {
    const container = await renderSidebar();

    const targets = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(targets).toEqual(["/inbox", "/issues", "/runs", "/reviews", "/usage"]);
    expect(container.textContent).not.toContain("Settings");
    expect(container.textContent).not.toContain("Runtimes");
    expect(container.textContent).not.toContain("Skills");
    expect(container.textContent).not.toContain("Design system");
    expect(container.textContent).not.toContain("Agents");
  });

  it("carries the open inbox count without opening a single entry", async () => {
    const container = await renderSidebar({ inboxCount: 3 });
    const inbox = [...container.querySelectorAll("a")].find(
      (link) => link.getAttribute("href") === "/inbox",
    );

    expect(inbox?.textContent).toContain("3");
  });

  it("shows no inbox badge when nothing needs the operator", async () => {
    const container = await renderSidebar({ inboxCount: 0 });
    const inbox = [...container.querySelectorAll("a")].find(
      (link) => link.getAttribute("href") === "/inbox",
    );

    expect(inbox?.textContent).toBe("Inbox");
  });

  it("opens settings from the project switcher", async () => {
    const onOpenSettings = vi.fn();
    await renderSidebar({ onOpenSettings });

    await act(async () => {
      switcherTrigger()?.click();
    });
    await act(async () => {
      findButton("Settings")?.click();
    });

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
