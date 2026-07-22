// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { IssueContract, LinearIssueSnapshot } from "@otomat/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinearIssueHeader } from "@web/components/issues/workspace/linear/linear-issue-header";
import { act, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

const getLinearEditor = vi.fn();
const getLinearWriteback = vi.fn();
const saveLinearDraft = vi.fn();
const publishLinearFields = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: {
    getLinearEditor: (id: string) => getLinearEditor(id),
    getLinearWriteback: (id: string) => getLinearWriteback(id),
    saveLinearDraft: (id: string, request: unknown) => saveLinearDraft(id, request),
    publishLinearFields: (id: string, request: unknown) => publishLinearFields(id, request),
    discardLinearDraft: () => Promise.resolve({ draft: null, writes: [] }),
  },
}));

const ISSUE: IssueContract = {
  id: "li",
  project_id: "p1",
  title: "Mirror",
  body: "Body",
  status: "ready",
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

const SNAPSHOT: LinearIssueSnapshot = {
  title: "Mirror",
  description: "Body",
  priority: 2,
  assignee_id: null,
  label_ids: [],
  external_id: "L-1",
  identifier: "OTO-99",
  url: "https://linear.app/otomat/issue/OTO-99",
  updated_at: "2026-07-20T10:00:00.000Z",
  assignee: null,
  labels: [],
  state: { id: "s-todo", name: "Todo", type: "unstarted", color: "#888" },
};

const EDITOR = {
  snapshot: SNAPSHOT,
  team_metadata: {
    team_id: "t1",
    states: [{ id: "s-todo", name: "Todo", type: "unstarted", color: "#888" }],
    members: [{ id: "u1", name: "Alim" }],
    labels: [{ id: "lab2", name: "Urgent", color: "#f00" }],
  },
};

const DRAFT = {
  id: "draft-1",
  issue_id: "li",
  base_updated_at: SNAPSHOT.updated_at,
  title: "Local title",
  description: "Body",
  priority: 2,
  assignee_id: null,
  label_ids: [],
  updated_at: "2026-07-21T12:00:00.000Z",
};

function withClient(node: ReactNode): ReactNode {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  vi.clearAllMocks();
  document.body.replaceChildren();
});

it("commits an inline title edit to the local draft", async () => {
  getLinearEditor.mockResolvedValue(EDITOR);
  getLinearWriteback.mockResolvedValue({ draft: null, writes: [] });
  saveLinearDraft.mockResolvedValue(DRAFT);

  rendered = await mount(withClient(<LinearIssueHeader issue={ISSUE} />));

  await vi.waitFor(() => {
    expect(findButton("Mirror")).toBeDefined();
    expect(document.body.textContent).toContain("Todo");
  });

  await act(async () => findButton("Mirror")?.click());
  const input = document.body.querySelector<HTMLInputElement>('input[aria-label="Issue title"]');
  expect(input).not.toBeNull();
  if (input === null) return;

  await act(async () => {
    setInputValue(input, "Sharper title");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });

  await vi.waitFor(() => {
    expect(saveLinearDraft).toHaveBeenCalledWith("li", {
      base_updated_at: SNAPSHOT.updated_at,
      title: "Sharper title",
      description: "Body",
      priority: 2,
      assignee_id: null,
      label_ids: [],
    });
  });
});

it("publishes the draft from the bar and overwrites only after an explicit conflict confirmation", async () => {
  getLinearEditor.mockResolvedValue(EDITOR);
  getLinearWriteback.mockResolvedValue({ draft: DRAFT, writes: [] });
  publishLinearFields
    .mockRejectedValueOnce(
      new DaemonRequestError(409, "/api/linear/issues/li/publish-fields", {
        error: "linear_write_conflict",
        message: "The Linear issue changed since you started editing.",
        remote: { ...SNAPSHOT, title: "Changed remotely", updated_at: "2026-07-21T09:00:00.000Z" },
      }),
    )
    .mockResolvedValueOnce({ draft: null, writes: [] });

  rendered = await mount(withClient(<LinearIssueHeader issue={ISSUE} />));

  await vi.waitFor(() => {
    expect(document.body.textContent).toContain("Unpublished draft");
    expect(findButton("Local title")).toBeDefined();
  });

  await act(async () => findButton("Publish to Linear")?.click());

  await vi.waitFor(() => {
    expect(publishLinearFields).toHaveBeenCalledWith("li", { overwrite: false });
    expect(document.body.textContent).toContain("The issue changed on Linear");
  });

  await act(async () => findButton("Overwrite Linear")?.click());

  await vi.waitFor(() => {
    expect(publishLinearFields).toHaveBeenCalledWith("li", { overwrite: true });
  });
});
