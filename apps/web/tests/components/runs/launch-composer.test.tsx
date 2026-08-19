// @vitest-environment happy-dom
import type { ContextReference, IssueContract, RuntimeDescriptor } from "@otomat/domain";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import { LaunchComposer } from "@web/components/runs/launch/launch-composer";
import { EMPTY_EXECUTION_SELECTION } from "@web/lib/execution/selection";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findLabelled } from "#support/dom-queries";
import { referencedIssue } from "#support/issue";
import { readyLaunchTarget } from "#support/launch-target";
import { mount } from "#support/mount";

const REFERENCED = referencedIssue();

interface FakeIssuesQuery {
  data: IssueContract[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

let issuesQuery: FakeIssuesQuery = {
  data: [REFERENCED],
  isLoading: false,
  isError: false,
};

vi.mock("@web/api/issues/queries", () => ({ useProjectIssues: () => issuesQuery }));

vi.mock("@web/api/daemon/queries", () => ({
  useRepositoryFiles: () => ({ data: { paths: [], omitted: 0 }, isPending: false, isError: false }),
}));

vi.mock("@web/components/execution/execution-config-picker", () => ({
  ExecutionConfigPicker: ({ label }: { label: string }) => (
    <div data-testid="execution-picker" data-label={label} />
  ),
}));

const RUNTIME: RuntimeDescriptor = {
  id: "claude",
  display_name: "claude",
  kind: "real",
  capabilities: {
    stream: true,
    steering: "turn_boundary",
    abort: true,
    resume: true,
    permissions: false,
    diff_hints: false,
  },
  availability: { status: "available", version: null },
};

const TARGET = readyLaunchTarget();

const EXECUTION: LaunchExecution = {
  agents: {
    descriptors: [RUNTIME],
    profiles: [],
    choice: "runtime:claude",
    isPending: false,
    isError: false,
    isSuccess: true,
    onRetry: vi.fn(),
  },
  selection: EMPTY_EXECUTION_SELECTION,
  request: { runtime: "claude" },
  canLaunch: true,
};

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  issuesQuery = { data: [REFERENCED], isLoading: false, isError: false };
});

interface ComposerOptions {
  issue?: IssueContract | null;
  references?: ContextReference[];
  unavailableReason?: string | null;
  onSubmit?: () => void;
}

function composer({
  issue = null,
  references = [],
  unavailableReason = null,
  onSubmit,
}: ComposerOptions) {
  return (
    <LaunchComposer
      issue={issue}
      target={TARGET}
      references={references}
      onReferencesChange={vi.fn()}
      execution={EXECUTION}
      onExecutionChange={vi.fn()}
      label="Ad-hoc run"
      action="Create & launch"
      unavailableReason={unavailableReason}
      pending={false}
      onSubmit={onSubmit ?? vi.fn()}
    >
      <textarea aria-label="Issue prompt" />
    </LaunchComposer>
  );
}

async function render(options: ComposerOptions = {}) {
  const mounted = await mount(composer(options));
  cleanups.push(mounted.cleanup);
  return { rerender: () => mounted.rerender(composer(options)) };
}

function bar(): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    "button[aria-label='Add context']",
  )?.parentElement;
  if (!found) throw new Error("composer bar not found");
  return found;
}

function labelled(label: string): HTMLElement {
  const found = findLabelled(label);
  if (!found) throw new Error(`element "${label}" not found`);
  return found;
}

it("puts the add control alone on the left and groups the branch with execution on the right", async () => {
  await render({});

  const [add, group, action] = [...bar().children];
  expect(add?.getAttribute("aria-label")).toBe("Add context");
  // Outlined, not the IconButton's borderless ghost default.
  expect(add?.className).toContain("border-border");
  expect(group?.className).toContain("ml-auto");
  expect(group?.firstElementChild?.getAttribute("aria-label")).toBe("Base branch: main");
  expect(group?.lastElementChild?.getAttribute("data-testid")).toBe("execution-picker");
  expect(action?.getAttribute("aria-label")).toBe("Create & launch");
});

it("folds its controls onto a second line rather than overflowing the composer", async () => {
  await render({});

  expect(bar().className).toContain("flex-wrap");
  const group = bar().children[1];
  expect(group?.className).toContain("flex-wrap");
  expect(group?.className).toContain("min-w-0");
});

it("names an attached issue by its public identifier, never by its internal id", async () => {
  await render({ references: [{ kind: "issue", issue_id: REFERENCED.id }] });

  expect(labelled("Ad-hoc run context").textContent).toContain("OTO-42");
  expect(document.body.textContent).not.toContain(REFERENCED.id.slice(0, 8));
});

it("holds a neutral chip while the reference resolves, then hydrates the public identifier", async () => {
  issuesQuery = { data: undefined, isLoading: true, isError: false };
  const { rerender } = await render({ references: [{ kind: "issue", issue_id: REFERENCED.id }] });

  const chips = labelled("Ad-hoc run context");
  expect(chips.textContent).toContain("Issue");
  expect(chips.textContent).not.toContain(REFERENCED.id.slice(0, 8));

  issuesQuery = { data: [REFERENCED], isLoading: false, isError: false };
  await rerender();

  expect(labelled("Ad-hoc run context").textContent).toContain("OTO-42");
});

it("states a failed lookup instead of reporting the reference as absent", async () => {
  issuesQuery = { data: undefined, isLoading: false, isError: true };
  await render({ references: [{ kind: "issue", issue_id: REFERENCED.id }] });

  await act(async () => labelled("Preview Issue").click());

  expect(document.body.textContent).toContain("could not be loaded");
});

it("reports a reference the loaded project does not hold as absent from it", async () => {
  issuesQuery = { data: [], isLoading: false, isError: false };
  await render({ references: [{ kind: "issue", issue_id: REFERENCED.id }] });

  await act(async () => labelled("Preview Issue").click());

  expect(document.body.textContent).toContain("not loaded in this project");
});

it("keeps the issue Otomat attached undetachable, and the optional ones removable", async () => {
  await render({
    issue: REFERENCED,
    references: [{ kind: "file", path: "src/parser.ts" }],
  });

  expect(document.querySelector("[aria-label='Remove OTO-42']")).toBeNull();
  expect(document.querySelector("[aria-label='Remove src/parser.ts']")).not.toBeNull();
});

it("launches on ⌘↵ from the instruction, not only from the action", async () => {
  const onSubmit = vi.fn();
  await render({ onSubmit });

  await act(async () => {
    labelled("Issue prompt").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
    );
  });

  expect(onSubmit).toHaveBeenCalledTimes(1);
});

it("refuses ⌘↵ on the same grounds the action states, instead of launching behind it", async () => {
  const onSubmit = vi.fn();
  await render({ unavailableReason: "write a prompt first", onSubmit });

  await act(async () => {
    labelled("Issue prompt").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
    );
  });

  expect(onSubmit).not.toHaveBeenCalled();
});

it("says why the action is unavailable in the only name an icon has", async () => {
  await render({ unavailableReason: "write a prompt first" });

  const action = document.querySelector<HTMLButtonElement>("button[aria-label^='Create & launch']");
  expect(action?.getAttribute("aria-label")).toBe("Create & launch — write a prompt first");
  expect(action?.getAttribute("title")).toContain("⌘↵");
  expect(action?.disabled).toBe(true);
});
