// @vitest-environment happy-dom
import {
  CLOSED_ISSUE_WORKSPACE,
  type AppendRunStepRequest,
  type IssueContract,
  type RunContract,
  type RuntimeDescriptor,
} from "@otomat/domain";
import { LaunchRunDialog } from "@web/components/issues/workspace/launch/dialog";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue, setTextareaValue } from "#support/dom-events";
import { findButton, findLabelled } from "#support/dom-queries";
import { executionDefaultsQueryResult } from "#support/execution-defaults";
import { repositoriesQueryResult, repositoryBranchesQueryResult } from "#support/launch-target";
import { mount } from "#support/mount";
import { modelCatalogQueryResult } from "#support/runtime-models";
import { providerOptionSetQueryResult } from "#support/runtime-options";

// SAFETY: the dialogs read only the launched run's id.
const launch = vi.fn(async () => ({ id: "run-1" }) as RunContract);
const navigate = vi.fn();
const onLaunched = vi.fn();
const pickerProps = vi.fn();

interface ExecutionPickerProbeProps {
  level: string;
  value: { agent: string | null; options: Record<string, unknown> };
  onChange: (value: unknown) => void;
}

const appendStep = vi.fn(
  (_request: AppendRunStepRequest, options?: { onSuccess?: (run: RunContract) => void }) => {
    // SAFETY: the success handler reads only the launched run's id.
    options?.onSuccess?.({ id: "run-7" } as RunContract);
  },
);
const appendTarget = vi.fn();

vi.mock("@web/api/runs/mutations", () => ({
  useAppendRunStep: (runId: string) => {
    appendTarget(runId);
    return { mutate: appendStep, isPending: false };
  },
}));

vi.mock("@web/api/runs/use-launch-run", () => ({
  useLaunchRun: () => ({ launch, isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimes: () => ({
    data: [
      {
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
      } satisfies RuntimeDescriptor,
    ],
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
  useRuntimeModels: () => modelCatalogQueryResult(),
  useRuntimeProviderOptions: () => providerOptionSetQueryResult(),
  useExecutionDefaults: () => executionDefaultsQueryResult(),
  useRepositories: () => repositoriesQueryResult(),
  useRepositoryBranches: () => repositoryBranchesQueryResult(),
  useRepositoryFiles: () => ({
    data: { paths: ["src/parser.ts"], omitted: 3 },
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@web/api/agent-profiles/queries", () => ({
  useAgentProfiles: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/api/workflow-presets/queries", () => ({
  useWorkflowPresets: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/api/skills/queries", () => ({
  useSkills: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/api/issues/queries", () => ({
  useProjectIssues: () => ({ data: [ISSUE, OTHER_ISSUE], isPending: false, isError: false }),
  useIssue: () => ({ data: ISSUE, isPending: false, isError: false }),
}));

vi.mock("@web/components/execution/execution-config-picker", () => ({
  ExecutionConfigPicker: (props: ExecutionPickerProbeProps) => {
    pickerProps(props);
    return (
      <button
        type="button"
        onClick={() => props.onChange({ ...props.value, model: { kind: "model", id: "opus" } })}
      >
        {`pick opus for ${props.level}`}
      </button>
    );
  },
}));

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

const OTHER_ISSUE: IssueContract = { ...ISSUE, id: "issue-2", title: "Backfill the fixtures" };

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  launch.mockClear();
  navigate.mockClear();
  onLaunched.mockClear();
  pickerProps.mockClear();
  appendStep.mockClear();
  appendTarget.mockClear();
});

function click(text: string) {
  const button = findButton(text);
  if (!button) throw new Error(`button "${text}" not found`);
  return act(async () => button.click());
}

function clickLabelled(label: string) {
  const control = findLabelled(label);
  if (!control) throw new Error(`control "${label}" not found`);
  return act(async () => control.click());
}

async function openDialog(issue: IssueContract = ISSUE) {
  const mounted = await mount(<LaunchRunDialog issue={issue} onLaunched={onLaunched} />);
  cleanups.push(mounted.cleanup);
  await click(issue.workspace.state === "open" ? "Add step" : "Launch run");
}

function textarea(label: string): HTMLTextAreaElement {
  const found = document.querySelector<HTMLTextAreaElement>(`textarea[aria-label='${label}']`);
  if (!found) throw new Error(`textarea "${label}" not found`);
  return found;
}

function input(label: string): HTMLInputElement {
  const found = document.querySelector<HTMLInputElement>(`input[aria-label='${label}']`);
  if (!found) throw new Error(`input "${label}" not found`);
  return found;
}

it("offers a single run and a workflow on the one launch surface", async () => {
  await openDialog();
  const labels = [...document.querySelectorAll("button")].map((button) => button.textContent);
  expect(labels).toContain("Single run");
  expect(labels).toContain("Workflow");
});

it("attaches the issue as context instead of copying it into an editable prompt", async () => {
  await openDialog();
  expect(textarea("Single run instructions").value).toBe("");
  expect(document.body.textContent).not.toContain("Quoting breaks on nested commas.");
  const chips = document.querySelector("ul[aria-label='Single run context']");
  expect(chips?.textContent).toContain("issue-1");
});

it("composes the single run on the shared launch bar, and stops repeating its action in the footer", async () => {
  await openDialog();

  expect(findLabelled("Add context")).not.toBeUndefined();
  expect(findLabelled("Launch run")).not.toBeUndefined();
  expect(findButton("Launch run⌘↵")).toBeUndefined();
});

it("launches with no user instruction at all when the note is left empty", async () => {
  await openDialog();
  await clickLabelled("Launch run");

  expect(launch).toHaveBeenCalledWith({
    issue_id: "issue-1",
    base_branch: "main",
    runtime: "claude",
  });
  expect(onLaunched).toHaveBeenCalledWith({ id: "run-1" });
  // The run belongs to the issue already on screen; navigating away would lose the workspace.
  expect(navigate).not.toHaveBeenCalled();
});

it("sends the optional note and the attached file as structured context", async () => {
  await openDialog();
  await act(async () =>
    setTextareaValue(textarea("Single run instructions"), "  Only fix the quoting  "),
  );
  await clickLabelled("Add context");
  await click("src/parser.ts");
  await clickLabelled("Launch run");

  expect(launch).toHaveBeenCalledWith({
    issue_id: "issue-1",
    base_branch: "main",
    note: "Only fix the quoting",
    context: [{ kind: "file", path: "src/parser.ts" }],
    runtime: "claude",
  });
});

it("removes an attached reference before the launch", async () => {
  await openDialog();
  await clickLabelled("Add context");
  await click("src/parser.ts");
  const remove = document.querySelector<HTMLButtonElement>(
    "button[aria-label='Remove src/parser.ts']",
  );
  if (!remove) throw new Error("remove control not found");
  await act(async () => remove.click());
  await clickLabelled("Launch run");

  expect(launch).toHaveBeenCalledWith({
    issue_id: "issue-1",
    base_branch: "main",
    runtime: "claude",
  });
});

it("sends the per-launch model override, on the same control every surface uses", async () => {
  await openDialog();

  expect(pickerProps).toHaveBeenCalledWith(
    expect.objectContaining({ level: "launch", value: { agent: "runtime:claude", options: {} } }),
  );

  await click("pick opus for launch");
  await clickLabelled("Launch run");

  expect(launch).toHaveBeenCalledWith({
    issue_id: "issue-1",
    base_branch: "main",
    runtime: "claude",
    model: { kind: "model", id: "opus" },
  });
});

it("reopens on the single run, since closing discarded whatever was composed", async () => {
  await openDialog();
  await click("Workflow");
  await click("Cancel");
  await click("Launch run");

  expect(textarea("Single run instructions").value).toBe("");
});

it("launches a multi-step workflow on the existing issue without inventing a second one", async () => {
  await openDialog();
  await click("Workflow");
  await click("Add step");

  const names = [...document.querySelectorAll<HTMLInputElement>("input[aria-label$=' name']")];
  await act(async () => {
    setInputValue(names[0]!, "Plan");
    setInputValue(names[1]!, "Build");
    setTextareaValue(textarea("Step 1 instructions"), "plan it");
    setTextareaValue(textarea("Step 2 instructions"), "build it");
  });
  await click("Plan");
  await click("Launch workflow⌘↵");

  expect(launch).toHaveBeenCalledWith({
    issue_id: "issue-1",
    base_branch: "main",
    runtime: "claude",
    plan: {
      version: 1,
      steps: [
        { id: "step-1", name: "Plan", agent: null, note: "plan it", depends_on: [] },
        { id: "step-2", name: "Build", agent: null, note: "build it", depends_on: ["step-1"] },
      ],
    },
  });
  expect(navigate).not.toHaveBeenCalled();
});

it("sends the base branch the user picked instead of the repository default", async () => {
  await openDialog();
  const trigger = document.querySelector<HTMLElement>("button[aria-label^='Base branch']");
  if (!trigger) throw new Error("base branch control not found");
  await act(async () => trigger.click());
  const option = [...document.querySelectorAll<HTMLElement>("[role='menuitemradio']")].find(
    (item) => item.textContent?.trim() === "develop",
  );
  if (!option) throw new Error("develop option not found");
  await act(async () => option.click());

  await clickLabelled("Launch run");

  expect(launch).toHaveBeenCalledWith(expect.objectContaining({ base_branch: "develop" }));
});

const CONTINUING: IssueContract = {
  ...ISSUE,
  workspace: { state: "open", run_id: "run-7", branch: "otomat/run/3a1be0dd", busy: false },
};

it("grows the open workspace instead of offering a second launch", async () => {
  await openDialog(CONTINUING);

  const labels = [...document.querySelectorAll("button")].map((button) => button.textContent);
  expect(labels).not.toContain("Single run");
  expect(labels).not.toContain("Workflow");
  expect(document.body.textContent).toContain("otomat/run/3a1be0dd");
  expect(appendTarget).toHaveBeenCalledWith("run-7");
});

it("refuses to append until the step is named, and never for a missing instruction", async () => {
  await openDialog(CONTINUING);
  expect(findButton("Add step⌘↵")?.disabled).toBe(true);

  await act(async () => setInputValue(input("Step name"), "Address the failing test"));
  expect(findButton("Add step⌘↵")?.disabled).toBe(false);
});

it("appends the step on the agent the user picked and follows the run it joined", async () => {
  await openDialog(CONTINUING);
  await act(async () => {
    setInputValue(input("Step name"), "  Address the failing test  ");
    setTextareaValue(textarea("Appended step instructions"), "  fix the parser  ");
  });
  await click("pick opus for launch");
  await click("Add step⌘↵");

  expect(appendStep).toHaveBeenCalledWith(
    {
      name: "Address the failing test",
      note: "fix the parser",
      runtime: "claude",
      model: { kind: "model", id: "opus" },
      depends_on: [],
    },
    expect.anything(),
  );
  expect(onLaunched).toHaveBeenCalledWith({ id: "run-7" });
  expect(launch).not.toHaveBeenCalled();
});

const STOPPED: IssueContract = {
  ...CONTINUING,
  execution: {
    state: "failed",
    run_id: "run-7",
    failure: { reason: "failed", step: { id: "step-2", name: "Reviewer" } },
  },
};

it("links the appended step to the failure it recovers", async () => {
  await openDialog(STOPPED);
  await act(async () => setInputValue(input("Step name"), "Review again"));

  expect(document.body.textContent).toContain("This step recovers");
  await click("Add step⌘↵");

  expect(appendStep).toHaveBeenCalledWith(
    expect.objectContaining({ replaces: "step-2" }),
    expect.anything(),
  );
});

it("leaves the failure standing when the step is not declared a recovery", async () => {
  await openDialog(STOPPED);
  await act(async () => setInputValue(input("Step name"), "Unrelated work"));
  const optOut = document.querySelector<HTMLElement>("[role='checkbox']");
  if (!optOut) throw new Error("recovery checkbox not found");
  await act(async () => optOut.click());
  await click("Add step⌘↵");

  expect(appendStep).toHaveBeenCalledWith(
    expect.not.objectContaining({ replaces: expect.anything() }),
    expect.anything(),
  );
});
