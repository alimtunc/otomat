// @vitest-environment happy-dom
import { CLOSED_ISSUE_WORKSPACE, type IssueContract } from "@otomat/domain";
import { IssueDetailView } from "@web/components/issues/issue/detail-view";
import { act, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubAnimations } from "#support/animations";
import { mount } from "#support/mount";
import { withQueryClient } from "#support/query";

const GROUP_STORAGE_KEY = "react-resizable-panels:otomat.issue-detail";
const RAIL_COLLAPSED_KEY = "otomat.panel.issue-rail.collapsed";

// The library measures a group as the sum of its panels' offsets, and happy-dom runs no layout engine.
const GROUP_SIZE = 1000;
for (const property of ["offsetWidth", "offsetHeight"]) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get: () => GROUP_SIZE / 2,
  });
}
Object.defineProperty(Element.prototype, "ariaDisabled", {
  configurable: true,
  get(this: Element) {
    return this.getAttribute("aria-disabled");
  },
});
stubAnimations();

let wide = true;

// The rail crash only reproduces when the issue resolves into an already-mounted group.
let issueLoaded = false;
const issueListeners = new Set<() => void>();
const subscribeIssue = (listener: () => void) => {
  issueListeners.add(listener);
  return () => issueListeners.delete(listener);
};
async function resolveIssue() {
  issueLoaded = true;
  await act(async () => {
    for (const listener of issueListeners) listener();
  });
}

const issue: IssueContract = {
  id: "issue-1",
  project_id: "project-1",
  title: "Fix the rail",
  body: null,
  status: "ready",
  execution: { state: "none", run_id: null },
  workspace: CLOSED_ISSUE_WORKSPACE,
  source: "local",
  source_external_id: null,
  source_identifier: null,
  source_url: null,
  synced_at: null,
  source_assignee_name: null,
  source_priority: null,
  source_labels: null,
  source_state_name: null,
  source_state_color: null,
};

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMediaQuery: () => wide,
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ issueId: "issue-1" }),
  useSearch: () => ({ run: undefined }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@web/components/shell/use-back-navigation", () => ({
  useBackNavigation: () => null,
}));

vi.mock("@web/api/issues/queries", () => ({
  useIssue: () => {
    const loaded = useSyncExternalStore(subscribeIssue, () => issueLoaded);
    return { isPending: !loaded, isError: false, data: loaded ? issue : undefined };
  },
}));

vi.mock("@web/api/runs/queries", () => ({
  useRunsForIssue: () => ({ isPending: false, isError: false, data: [] }),
}));

vi.mock("@web/components/shell/route-shell", () => ({
  RouteShell: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@web/components/issues/issue/header", () => ({
  IssueHeader: () => <div data-testid="issue-header" />,
}));

vi.mock("@web/components/issues/workspace/launch/dialog", () => ({
  LaunchRunDialog: () => <div data-testid="launch" />,
}));

vi.mock("@web/components/issues/workspace/run-conversations", () => ({
  RunConversations: () => <div data-testid="conversations" />,
}));

const mounted: Array<() => Promise<void>> = [];

async function renderView() {
  const { container, cleanup } = await mount(withQueryClient(<IssueDetailView />));
  mounted.push(cleanup);
  return container;
}

beforeEach(() => {
  window.localStorage.clear();
  wide = true;
  issueLoaded = false;
});

afterEach(async () => {
  for (const cleanup of mounted.splice(0)) await cleanup();
  window.localStorage.clear();
});

const railPanelOf = (container: HTMLElement) =>
  container.querySelector('[data-slot="resizable-panel"][id="issue-rail"]');

const toggleOf = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('button[aria-controls="issue-rail"]');

describe("IssueDetailView rail panel", () => {
  it("mounts the rail panel while the issue is still loading", async () => {
    const container = await renderView();

    expect(railPanelOf(container)).not.toBeNull();
  });

  it("opens against a stale two-panel layout persisted before the rail loads", async () => {
    window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify({ issue: 70, "issue-rail": 30 }));

    const container = await renderView();
    expect(railPanelOf(container)).not.toBeNull();

    await resolveIssue();

    expect(container.textContent).toContain("Properties");
  });

  it("opens against a stale collapsed layout and keeps the rail collapsed", async () => {
    window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify({ issue: 96, "issue-rail": 4 }));
    window.localStorage.setItem(RAIL_COLLAPSED_KEY, "true");

    const container = await renderView();

    expect(toggleOf(container)?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("Issue details");
  });

  it("collapses and expands the rail once the issue has loaded", async () => {
    issueLoaded = true;
    const container = await renderView();

    const collapse = toggleOf(container);
    if (collapse === null) throw new Error("no rail toggle rendered");
    expect(collapse.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      collapse.click();
    });
    expect(window.localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("true");
    expect(toggleOf(container)?.getAttribute("aria-expanded")).toBe("false");

    const expand = toggleOf(container);
    if (expand === null) throw new Error("no rail toggle rendered");
    await act(async () => {
      expand.click();
    });
    expect(window.localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("false");
    expect(container.textContent).toContain("Properties");
  });

  it("resizes the rail from its handle", async () => {
    issueLoaded = true;
    const container = await renderView();
    const separator = container.querySelector<HTMLElement>('[role="separator"]');
    if (separator === null) throw new Error("no resize handle rendered");

    expect(separator.getAttribute("aria-label")).toBe("Resize Issue details");

    await act(async () => {
      separator.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowLeft" }),
      );
    });

    const raw = window.localStorage.getItem(GROUP_STORAGE_KEY);
    if (raw === null) throw new Error("no persisted layout");
    const stored: Record<string, number | undefined> = JSON.parse(raw);
    expect(stored["issue-rail"]).toBeGreaterThan(0);
  });

  it("renders no panel group on narrow viewports", async () => {
    wide = false;
    issueLoaded = true;
    const container = await renderView();

    expect(container.querySelector('[data-slot="resizable-panel-group"]')).toBeNull();
    expect(container.textContent).toContain("Properties");
  });
});
