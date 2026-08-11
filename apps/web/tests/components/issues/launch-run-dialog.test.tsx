// @vitest-environment happy-dom
import {
  CLOSED_ISSUE_WORKSPACE,
  type AppendRunStepRequest,
  type IssueContract,
  type ModelSelection,
  type RunContract,
  type RuntimeDescriptor,
} from "@otomat/domain";
import { LaunchRunDialog } from "@web/components/issues/workspace/launch/dialog";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue, setTextareaValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { repositoriesQueryResult, repositoryBranchesQueryResult } from "#support/launch-target";
import { mount } from "#support/mount";
import { modelCatalogQueryResult } from "#support/runtime-models";
import { providerOptionSetQueryResult } from "#support/runtime-options";

const launch = vi.fn(async () => ({ id: "run-1" }) as RunContract);
const navigate = vi.fn();
const onLaunched = vi.fn();
const modelSelectProps = vi.fn();

interface ModelSelectProbeProps {
  runtimeId: string | null;
  onValueChange: (value: ModelSelection | undefined) => void;
}

const appendStep = vi.fn(
  (_request: AppendRunStepRequest, options?: { onSuccess?: (run: RunContract) => void }) => {
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
  useRepositories: () => repositoriesQueryResult(),
  useRepositoryBranches: () => repositoryBranchesQueryResult(),
}));

vi.mock("@web/api/agent-profiles/queries", () => ({
  useAgentProfiles: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/components/runs/launch/launch-agent-select", () => ({
  LaunchAgentSelect: () => <div data-testid="agent-select" />,
}));

vi.mock("@web/components/runs/launch/model-select", () => ({
  ModelSelect: (props: ModelSelectProbeProps) => {
    modelSelectProps(props);
    return (
      <button type="button" onClick={() => props.onValueChange({ kind: "model", id: "opus" })}>
        pick opus
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

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  launch.mockClear();
  navigate.mockClear();
  onLaunched.mockClear();
  modelSelectProps.mockClear();
  appendStep.mockClear();
  appendTarget.mockClear();
});

function click(text: string) {
  const button = findButton(text);
  if (!button) throw new Error(`button "${text}" not found`);
  return act(async () => button.click());
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

it("shows the prompt a single run starts from, description included", async () => {
  await openDialog();
  expect(textarea("Single run prompt").value).toBe(
    "Ship the CSV parser\n\nQuoting breaks on nested commas.",
  );
});

it("falls back to the title alone when the issue has no description", async () => {
  await openDialog({ ...ISSUE, body: null });
  expect(textarea("Single run prompt").value).toBe("Ship the CSV parser");
});

it("sends the prompt on screen, edits included, and follows the run in place", async () => {
  await openDialog();
  await act(async () => setTextareaValue(textarea("Single run prompt"), "Only fix the quoting"));
  await click("Launch run⌘↵");

  expect(launch).toHaveBeenCalledWith({
    issue_id: "issue-1",
    prompt: "Only fix the quoting",
    base_branch: "main",
    runtime: "claude",
  });
  expect(onLaunched).toHaveBeenCalledWith({ id: "run-1" });
  // The run belongs to the issue already on screen; navigating away would lose the workspace.
  expect(navigate).not.toHaveBeenCalled();
});

it("sends the per-launch model override, listed against the agent's own runtime", async () => {
  await openDialog();

  expect(modelSelectProps).toHaveBeenCalledWith(
    expect.objectContaining({ runtimeId: "claude", value: undefined }),
  );

  await click("pick opus");
  await click("Launch run⌘↵");

  expect(launch).toHaveBeenCalledWith({
    issue_id: "issue-1",
    prompt: "Ship the CSV parser\n\nQuoting breaks on nested commas.",
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

  expect(textarea("Single run prompt").value).toBe(
    "Ship the CSV parser\n\nQuoting breaks on nested commas.",
  );
});

it("launches a multi-step workflow on the existing issue without inventing a second one", async () => {
  await openDialog();
  await click("Workflow");
  await click("Add step");

  const names = [...document.querySelectorAll<HTMLInputElement>("input[aria-label$=' name']")];
  await act(async () => {
    setInputValue(names[0]!, "Plan");
    setInputValue(names[1]!, "Build");
    setTextareaValue(textarea("Step 1 prompt"), "plan it");
    setTextareaValue(textarea("Step 2 prompt"), "build it");
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
        { id: "step-1", name: "Plan", agent: null, prompt: "plan it", depends_on: [] },
        { id: "step-2", name: "Build", agent: null, prompt: "build it", depends_on: ["step-1"] },
      ],
    },
  });
  expect(navigate).not.toHaveBeenCalled();
});

it("sends the base branch the user picked instead of the repository default", async () => {
  await openDialog();
  const trigger = document.querySelector<HTMLElement>("button[aria-label='Base branch']");
  if (!trigger) throw new Error("base branch select not found");
  await act(async () => trigger.click());
  const option = [...document.querySelectorAll<HTMLElement>("[role='option']")].find(
    (item) => item.textContent?.trim() === "develop",
  );
  if (!option) throw new Error("develop option not found");
  await act(async () => option.click());

  await click("Launch run⌘↵");

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

it("refuses to append until the step has both a name and a prompt", async () => {
  await openDialog(CONTINUING);
  const submit = findButton("Add step⌘↵");
  expect(submit?.disabled).toBe(true);

  await act(async () => setInputValue(input("Step name"), "Address the failing test"));
  expect(findButton("Add step⌘↵")?.disabled).toBe(true);

  await act(async () => setTextareaValue(textarea("Step prompt"), "fix the parser"));
  expect(findButton("Add step⌘↵")?.disabled).toBe(false);
});

it("appends the step on the agent the user picked and follows the run it joined", async () => {
  await openDialog(CONTINUING);
  await act(async () => {
    setInputValue(input("Step name"), "  Address the failing test  ");
    setTextareaValue(textarea("Step prompt"), "  fix the parser  ");
  });
  await click("pick opus");
  await click("Add step⌘↵");

  expect(appendStep).toHaveBeenCalledWith(
    {
      name: "Address the failing test",
      prompt: "fix the parser",
      runtime: "claude",
      model: { kind: "model", id: "opus" },
      depends_on: [],
    },
    expect.anything(),
  );
  expect(onLaunched).toHaveBeenCalledWith({ id: "run-7" });
  expect(launch).not.toHaveBeenCalled();
});
