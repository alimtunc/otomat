// @vitest-environment happy-dom
import type { ConversationThreadEntry } from "@otomat/domain";
import type { ConversationsQuery } from "@web/api/conversations/queries";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";
import { Sidebar } from "@web/components/shell/sidebar";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubAnimations } from "#support/animations";
import { conversationEntry, terminalConversationEntry } from "#support/conversations";
import { setInputValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";

let href = "/issues";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (state: { location: { href: string } }) => string }) =>
    select({ location: { href } }),
}));

function conversationsQuery(entries: ConversationThreadEntry[]) {
  // SAFETY: the sidebar reads only these five fields, not the full query-state union.
  return {
    data: { entries },
    isError: false,
    isFetching: false,
    dataUpdatedAt: 0,
    refetch: vi.fn(),
  } as ConversationsQuery;
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
stubAnimations();

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  href = "/issues";
  projectLayoutStore.setState(() => ({ ungrouped: [], groups: [], icons: {} }));
});

async function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <Sidebar
        active="issues"
        hostLabel="Local"
        conversations={conversationsQuery([])}
        inboxes={[]}
        projects={[{ id: "local-default", name: "Local workspace" }]}
        currentProjectId="local-default"
        onProjectSelect={vi.fn()}
        onOrganizeProjects={vi.fn()}
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

    expect(onProjectSelect).toHaveBeenCalledWith("local-default", "/project");
  });

  it("links only Inbox, Conversations and Settings; project views are buttons", async () => {
    const container = await renderSidebar();

    const targets = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(targets).toEqual(["/inbox", "/conversations", "/settings"]);
    expect(container.textContent).toContain("All runs");
    expect(container.textContent).toContain("Issues");
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

  it("badges unread conversations directly below Inbox, outside Workspace", async () => {
    href = "/conversations";
    const container = await renderSidebar({
      active: "conversations",
      inboxCount: 0,
      conversations: conversationsQuery([
        conversationEntry({ id: "c1", read: false }),
        conversationEntry({ id: "c2", read: false }),
      ]),
    });
    const links = [...container.querySelectorAll("a")];
    const conversations = links.find((link) => link.getAttribute("href") === "/conversations");
    const inbox = links.find((link) => link.getAttribute("href") === "/inbox");
    const workspace = container.querySelector('nav[aria-label="Local workspace views"]');

    expect(conversations?.textContent).toContain("2");
    expect(conversations?.getAttribute("aria-current")).toBe("page");
    expect(inbox?.nextElementSibling).toBe(conversations);
    expect(workspace?.contains(conversations ?? null)).toBe(false);
    expect(inbox?.textContent).toBe("Inbox");
  });

  it("shows no inbox badge when nothing needs the operator", async () => {
    const container = await renderSidebar({ inboxCount: 0 });
    const inbox = [...container.querySelectorAll("a")].find(
      (link) => link.getAttribute("href") === "/inbox",
    );

    expect(inbox?.textContent).toBe("Inbox");
  });

  it("opens settings for the active project from the switcher and closes it", async () => {
    const onProjectSelect = vi.fn();
    await renderSidebar({
      onProjectSelect,
      projects: [
        { id: "local:other", name: "Other" },
        { id: "local:current", name: "Current" },
      ],
      currentProjectId: "local:current",
    });

    await act(async () => {
      switcherTrigger()?.click();
    });

    await act(async () => findButton("Project settings")?.click());

    expect(onProjectSelect).toHaveBeenCalledExactlyOnceWith("local:current", "/settings/project");
    expect(switcherTrigger()?.getAttribute("aria-expanded")).toBe("false");
  });

  it("lists projects in the operator's groups and order", async () => {
    projectLayoutStore.setState(() => ({
      ungrouped: ["local:b"],
      groups: [{ id: "crm", name: "CRM", collapsed: true, projects: ["local:c", "local:a"] }],
      icons: {},
    }));
    await renderSidebar({
      projects: [
        { id: "local:a", name: "Alpha" },
        { id: "local:b", name: "Bravo" },
        { id: "local:c", name: "Charlie" },
      ],
      currentProjectId: "local:a",
    });

    await act(async () => {
      switcherTrigger()?.click();
    });

    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options.map((option) => option.querySelector(".truncate")?.textContent)).toEqual([
      "Bravo",
      "Charlie",
      "Alpha",
    ]);
    expect(options[0]?.closest('[role="group"]')?.textContent).not.toContain("CRM");
    expect(options[1]?.closest('[role="group"]')?.textContent).toContain("CRM");
  });

  it("searches across the groups and says when nothing matches", async () => {
    projectLayoutStore.setState(() => ({
      ungrouped: [],
      groups: [{ id: "crm", name: "CRM", collapsed: false, projects: ["local:c"] }],
      icons: {},
    }));
    await renderSidebar({
      projects: [
        { id: "local:a", name: "Alpha" },
        { id: "local:c", name: "Charlie" },
      ],
      currentProjectId: "local:a",
    });
    await act(async () => {
      switcherTrigger()?.click();
    });
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Find project"]');
    if (input === null) throw new Error("project search field missing");

    await act(async () => setInputValue(input, "char"));
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options.map((option) => option.querySelector(".truncate")?.textContent)).toEqual([
      "Charlie",
    ]);
    expect(options[0]?.closest('[role="group"]')?.textContent).toContain("CRM");

    await act(async () => setInputValue(input, "zzz"));
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(document.body.textContent).toContain("No projects found.");
  });

  it("opens a terminal conversation in its project without activating the global list", async () => {
    const entry = terminalConversationEntry({ read: true });
    const onProjectSelect = vi.fn();
    href = `/conversations?terminal=${entry.terminal.id}`;
    const container = await renderSidebar({
      active: "conversations",
      conversations: conversationsQuery([entry]),
      onProjectSelect,
      projects: [{ id: "local:p1", name: "Otomat" }],
      currentProjectId: "local:p1",
    });
    await act(async () => findButton("Codex terminal")?.click());
    expect(onProjectSelect).toHaveBeenCalledExactlyOnceWith(
      "local:p1",
      `/conversations?terminal=${entry.terminal.id}`,
    );
    expect(container.querySelector('a[href="/conversations"]')?.hasAttribute("aria-current")).toBe(
      false,
    );
  });
  it("enters the organize mode from the switcher", async () => {
    const onOrganizeProjects = vi.fn();
    await renderSidebar({ onOrganizeProjects });

    await act(async () => {
      switcherTrigger()?.click();
    });
    await act(async () => findButton("Organize projects…")?.click());

    expect(onOrganizeProjects).toHaveBeenCalledOnce();
  });
});
