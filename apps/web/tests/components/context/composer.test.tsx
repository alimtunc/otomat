// @vitest-environment happy-dom
import { CLOSED_ISSUE_WORKSPACE, type ContextReference, type IssueContract } from "@otomat/domain";
import { ContextComposer } from "@web/components/context/context-composer";
import { ContextSourcesPanel } from "@web/components/context/context-sources-panel";
import { EMPTY_CONTEXT_DRAFT, type ContextDraft } from "@web/lib/context/draft";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { repositoriesQueryResult } from "#support/launch-target";
import { mount } from "#support/mount";

const ISSUE: IssueContract = {
  id: "issue-1",
  project_id: "p1",
  title: "Ship the CSV parser",
  body: "Quoting breaks on nested commas.",
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

const OTHER: IssueContract = { ...ISSUE, id: "issue-2", title: "Backfill the fixtures" };

let filesQuery = {
  data: { paths: ["src/parser.ts"], omitted: 2 },
  isPending: false,
  isError: false,
};
const fileSearches = vi.fn();

vi.mock("@web/api/daemon/queries", () => ({
  useRepositories: () => repositoriesQueryResult(),
  useRepositoryFiles: (repositoryId: string | null, query: string) => {
    fileSearches(repositoryId, query);
    return filesQuery;
  },
}));

vi.mock("@web/api/issues/queries", () => ({
  useProjectIssues: () => ({ data: [ISSUE, OTHER], isPending: false, isError: false }),
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  fileSearches.mockClear();
  filesQuery = { data: { paths: ["src/parser.ts"], omitted: 2 }, isPending: false, isError: false };
});

function click(text: string) {
  const button = findButton(text);
  if (!button) throw new Error(`button "${text}" not found`);
  return act(async () => button.click());
}

function byLabel(label: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[aria-label='${label}']`);
  if (!found) throw new Error(`element "${label}" not found`);
  return found;
}

/** Result rows compose an identifier and a title, so they are matched on a fragment. */
function clickContaining(text: string) {
  const button = [...document.body.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!button) throw new Error(`button containing "${text}" not found`);
  return act(async () => button.click());
}

async function mountComposer(value: ContextDraft = EMPTY_CONTEXT_DRAFT) {
  const onChange = vi.fn();
  const mounted = await mount(
    <ContextComposer
      issue={ISSUE}
      projectId="p1"
      value={value}
      onChange={onChange}
      label="Step 1"
    />,
  );
  cleanups.push(mounted.cleanup);
  return onChange;
}

it("shows the issue as an undetachable chip and previews what it will freeze", async () => {
  await mountComposer();

  const chips = byLabel("Step 1 context");
  expect(chips.textContent).toContain("issue-1");
  expect(document.querySelector("[aria-label='Remove issue-1']")).toBeNull();

  await act(async () => byLabel("Preview issue-1").click());
  expect(document.body.textContent).toContain("Quoting breaks on nested commas.");
});

it("searches issues and files, and attaches one by identity", async () => {
  const onChange = await mountComposer();

  await click("Add context");
  await act(async () =>
    setInputValue(byLabel("Step 1 context search") as HTMLInputElement, "back"),
  );
  expect(fileSearches).toHaveBeenLastCalledWith("repo-1", "back");
  await clickContaining("Backfill the fixtures");

  expect(onChange).toHaveBeenCalledWith({
    references: [{ kind: "issue", issue_id: "issue-2" }],
    note: "",
  });
});

it("says how many matches a narrowed file search is holding back", async () => {
  await mountComposer();
  await click("Add context");
  expect(document.body.textContent).toContain("2 further match(es)");
});

it("removes an attached reference from the keyboard", async () => {
  const references: ContextReference[] = [{ kind: "file", path: "src/parser.ts" }];
  const onChange = await mountComposer({ references, note: "" });

  const chip = byLabel("Preview src/parser.ts");
  await act(async () => {
    chip.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
  });

  expect(onChange).toHaveBeenCalledWith({ references: [], note: "" });
});

it("says a project with no repository cannot attach files, rather than showing none", async () => {
  filesQuery = { data: { paths: [], omitted: 0 }, isPending: false, isError: true };
  await mountComposer();
  await click("Add context");
  expect(document.body.textContent).toContain("Couldn’t read this repository’s files.");
});

it("lists the context sources without offering a prompt to edit", async () => {
  const mounted = await mount(
    <ContextSourcesPanel
      sources={[{ id: "issue", label: "Issue snapshot attached", detail: "OTO-1" }]}
    />,
  );
  cleanups.push(mounted.cleanup);
  await click("What this agent receives");
  expect(document.body.textContent).toContain("Issue snapshot attached");
});
