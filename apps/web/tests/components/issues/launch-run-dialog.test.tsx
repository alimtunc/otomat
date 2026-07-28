// @vitest-environment happy-dom
import type { IssueContract, ModelSelection, RunContract, RuntimeDescriptor } from "@otomat/domain";
import { LaunchRunDialog } from "@web/components/issues/workspace/launch/dialog";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue, setTextareaValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";
import { modelCatalogQueryResult } from "#support/runtime-models";

const launch = vi.fn(async () => ({ id: "run-1" }) as RunContract);
const navigate = vi.fn();
const onLaunched = vi.fn();
const modelSelectProps = vi.fn();

interface ModelSelectProbeProps {
  runtimeId: string | null;
  onValueChange: (value: ModelSelection | undefined) => void;
}

vi.mock("@web/api/runs/mutations", () => ({
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
          send_message: true,
          abort: true,
          resume: true,
          permissions: false,
          diff_hints: false,
        },
        availability: { status: "available", version: null },
        provider_options: [],
      } satisfies RuntimeDescriptor,
    ],
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
  useRuntimeModels: () => modelCatalogQueryResult(),
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
});

function click(text: string) {
  const button = findButton(text);
  if (!button) throw new Error(`button "${text}" not found`);
  return act(async () => button.click());
}

async function openDialog(issue: IssueContract = ISSUE) {
  const mounted = await mount(<LaunchRunDialog issue={issue} onLaunched={onLaunched} />);
  cleanups.push(mounted.cleanup);
  await click("Launch run");
}

function textarea(label: string): HTMLTextAreaElement {
  const found = document.querySelector<HTMLTextAreaElement>(`textarea[aria-label='${label}']`);
  if (!found) throw new Error(`textarea "${label}" not found`);
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
