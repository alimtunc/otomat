// @vitest-environment happy-dom
import type {
  IssueContract,
  IssueSourceLifecycle,
  LinearLifecycleSyncState,
  LinearWritebackState,
} from "@otomat/domain";
import { LinearRailSection } from "@web/components/issues/workspace/linear/rail-section";
import { act, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mountWithQuery, type Mounted } from "#support/mount";

const getLinearEditor = vi.fn();
const getLinearWriteback = vi.fn();
const retryLinearWrite = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="#settings">{children}</a>,
}));

vi.mock("@web/api/client", () => ({
  daemon: {
    getLinearEditor: (id: string) => getLinearEditor(id),
    getLinearWriteback: (id: string) => getLinearWriteback(id),
    retryLinearWrite: (writeId: string) => retryLinearWrite(writeId),
  },
}));

const ISSUE: IssueContract = {
  id: "li",
  project_id: "p1",
  title: "Mirror",
  body: "Body",
  status: "ready",
  execution: { state: "none", run_id: null },
  source: "linear",
  source_external_id: "ext-1",
  source_identifier: "OTO-99",
  source_url: "https://linear.app/otomat/issue/OTO-99",
  synced_at: "2026-07-20T10:00:00.000Z",
  source_assignee_name: null,
  source_priority: 2,
  source_labels: null,
  source_state_name: "Todo",
  source_state_color: "#888",
};

const EDITOR = {
  snapshot: {
    title: "Mirror",
    description: "Body",
    priority: 2,
    assignee_id: null,
    label_ids: [],
    external_id: "ext-1",
    identifier: "OTO-99",
    url: "https://linear.app/otomat/issue/OTO-99",
    updated_at: "2026-07-20T10:00:00.000Z",
    assignee: null,
    labels: [],
    state: { id: "s-todo", name: "Todo", type: "unstarted", color: "#888" },
  },
  team_metadata: { team_id: "t1", states: [], members: [], labels: [] },
};

function lifecycle(overrides: Partial<LinearLifecycleSyncState> = {}): LinearLifecycleSyncState {
  return {
    write_id: "w-1",
    phase: "done",
    target_state_id: "s-shipped",
    target_state_name: "Shipped",
    status: "sent",
    detail: "Done → Shipped",
    error_code: null,
    error_message: null,
    updated_at: "2026-07-21T12:00:00.000Z",
    ...overrides,
  };
}

const MAPPED: IssueSourceLifecycle = {
  in_progress: { id: "s-doing", name: "Doing" },
  done: { id: "s-shipped", name: "Shipped" },
};

function writeback(sync: LinearLifecycleSyncState): LinearWritebackState {
  return {
    lifecycle_mapping: MAPPED,
    draft: null,
    writes: [
      {
        id: sync.write_id,
        issue_id: ISSUE.id,
        run_id: "r-1",
        kind: "lifecycle",
        status: sync.status,
        idempotency_key: "key-1",
        detail: sync.detail,
        remote_id: null,
        error_code: sync.error_code,
        error_message: sync.error_message,
        created_at: sync.updated_at,
        updated_at: sync.updated_at,
      },
    ],
    lifecycle: sync,
  };
}

function retryButtons(): HTMLButtonElement[] {
  return [...document.body.querySelectorAll("button")].filter(
    (button) => button.textContent?.trim() === "Retry",
  );
}

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  vi.clearAllMocks();
  document.body.replaceChildren();
});

it("says an unmapped source syncs nothing instead of staying silent", async () => {
  getLinearEditor.mockResolvedValue(EDITOR);
  getLinearWriteback.mockResolvedValue({
    draft: null,
    writes: [],
    lifecycle: null,
    lifecycle_mapping: { in_progress: null, done: null },
  });

  rendered = await mountWithQuery(<LinearRailSection issue={ISSUE} run={null} />);

  await vi.waitFor(() => {
    expect(rendered?.container.textContent).toContain("Status sync is not configured");
  });
  expect(rendered?.container.textContent).toContain("Map its Linear statuses");
});

it("reports the mapping in force while no phase has been asserted yet", async () => {
  getLinearEditor.mockResolvedValue(EDITOR);
  getLinearWriteback.mockResolvedValue({
    draft: null,
    writes: [],
    lifecycle: null,
    lifecycle_mapping: MAPPED,
  });

  rendered = await mountWithQuery(<LinearRailSection issue={ISSUE} run={null} />);

  await vi.waitFor(() => {
    expect(rendered?.container.textContent).toContain("Run started → Doing");
  });
  expect(rendered?.container.textContent).toContain("Pull request merged → Shipped");
});

it("refuses to call a half-mapped source configured", async () => {
  getLinearEditor.mockResolvedValue(EDITOR);
  getLinearWriteback.mockResolvedValue({
    draft: null,
    writes: [],
    lifecycle: null,
    lifecycle_mapping: { in_progress: MAPPED.in_progress, done: null },
  });

  rendered = await mountWithQuery(<LinearRailSection issue={ISSUE} run={null} />);

  await vi.waitFor(() => {
    expect(rendered?.container.textContent).toContain("has no state for pull request merged");
  });
  expect(rendered?.container.textContent).not.toContain("is configured");
});

it("names the Linear status the daemon last mirrored, and what it was for", async () => {
  getLinearEditor.mockResolvedValue(EDITOR);
  getLinearWriteback.mockResolvedValue(writeback(lifecycle()));

  rendered = await mountWithQuery(<LinearRailSection issue={ISSUE} run={null} />);

  await vi.waitFor(() => {
    expect(rendered?.container.textContent).toContain("Pull request merged → Shipped");
    expect(rendered?.container.textContent).toContain("sent");
  });
  expect(findButton("Retry")).toBeUndefined();
});

it("shows a refused sync as failed with its reason and retries that exact write", async () => {
  getLinearEditor.mockResolvedValue(EDITOR);
  const failed = lifecycle({
    phase: "in_progress",
    target_state_name: "Doing",
    status: "failed",
    error_code: "linear_unauthorized",
    error_message: "Linear rejected the API key. Create a new key and connect again.",
  });
  getLinearWriteback.mockResolvedValue(writeback(failed));
  retryLinearWrite.mockResolvedValue(writeback(lifecycle()));

  rendered = await mountWithQuery(<LinearRailSection issue={ISSUE} run={null} />);

  await vi.waitFor(() => {
    expect(rendered?.container.textContent).toContain("Run started → Doing");
    expect(rendered?.container.textContent).toContain("Linear rejected the API key");
  });
  expect(retryButtons()).toHaveLength(1);

  await act(async () => findButton("Retry")?.click());

  await vi.waitFor(() => expect(retryLinearWrite).toHaveBeenCalledWith("w-1"));
});
