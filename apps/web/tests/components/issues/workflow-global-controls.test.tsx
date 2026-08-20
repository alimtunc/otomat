// @vitest-environment happy-dom
import type { RunContract, RuntimeDescriptor } from "@otomat/domain";
import { WorkflowLaunchForm } from "@web/components/issues/workflow/form";
import { EMPTY_EXECUTION_SELECTION, type ExecutionSelection } from "@web/lib/execution/selection";
import { act, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { referencedIssue } from "#support/issue";
import { readyLaunchTarget, repositoriesQueryResult } from "#support/launch-target";
import { mount } from "#support/mount";

const ISSUE = referencedIssue();

// SAFETY: the dialogs read only the launched run's id.
const launch = vi.fn(async () => ({ id: "run-1" }) as RunContract);
const pickerProps = vi.fn();

interface PickerProbeProps {
  level: string;
  label: string;
  value: ExecutionSelection;
  onChange: (value: ExecutionSelection) => void;
}

function runtimeDescriptor(id: string): RuntimeDescriptor {
  return {
    id,
    display_name: id,
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
}

vi.mock("@web/api/runs/use-launch-run", () => ({
  useLaunchRun: () => ({ launch, isPending: false }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimes: () => ({
    data: [runtimeDescriptor("claude"), runtimeDescriptor("codex")],
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
  useRepositoryFiles: () => ({ data: { paths: [], omitted: 0 }, isPending: false, isError: false }),
  useRepositories: () => repositoriesQueryResult(),
}));

vi.mock("@web/api/agent-profiles/queries", () => ({
  useAgentProfiles: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/api/workflow-presets/queries", () => ({
  useWorkflowPresets: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/api/issues/queries", () => ({
  useProjectIssues: () => ({ data: [ISSUE], isPending: false, isError: false }),
}));

vi.mock("@web/components/execution/execution-config-picker", () => ({
  ExecutionConfigPicker: (props: PickerProbeProps) => {
    pickerProps(props);
    return (
      <div data-testid="execution-picker" data-label={props.label} data-level={props.level}>
        <button
          type="button"
          onClick={() => props.onChange({ agent: "runtime:codex", options: {} })}
        >
          {`pick codex for ${props.label}`}
        </button>
        <button
          type="button"
          onClick={() => props.onChange({ ...props.value, model: { kind: "model", id: "opus" } })}
        >
          {`pick opus for ${props.label}`}
        </button>
      </div>
    );
  },
}));

const TARGET = readyLaunchTarget();

function Harness() {
  const [execution, setExecution] = useState<ExecutionSelection>(EMPTY_EXECUTION_SELECTION);
  return (
    <WorkflowLaunchForm
      target={{ kind: "issue", issue: ISSUE }}
      worktreeTarget={TARGET}
      execution={execution}
      onExecutionChange={setExecution}
      onLaunched={vi.fn()}
      onCancel={vi.fn()}
    />
  );
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  launch.mockClear();
  pickerProps.mockClear();
});

async function openWorkflow() {
  const mounted = await mount(<Harness />);
  cleanups.push(mounted.cleanup);
}

function click(text: string) {
  const button = findButton(text);
  if (!button) throw new Error(`button "${text}" not found`);
  return act(async () => button.click());
}

function globalRow(): HTMLElement {
  const row = findButton("Presets")?.parentElement;
  if (!row) throw new Error("global control row not found");
  return row;
}

function stepCard(): HTMLElement {
  const card = document.querySelector("input[aria-label='Step 1 name']")?.closest("div.rounded-lg");
  if (!(card instanceof HTMLElement)) throw new Error("step 1 card not found");
  return card;
}

/** The last props the probe saw for a node, which is what that node currently reads. */
function lastPickerValue(label: string): ExecutionSelection {
  const calls = pickerProps.mock.calls.map(([props]: [PickerProbeProps]) => props);
  const last = calls.filter((props) => props.label === label).at(-1);
  if (!last) throw new Error(`no execution picker for "${label}"`);
  return last.value;
}

it("carries the ticket, the preset, the base branch and the inherited execution on one row", async () => {
  await openWorkflow();
  const row = globalRow();

  expect(row.className).toContain("flex-wrap");
  expect(row.querySelector("ul[aria-label='Workflow context']")?.textContent).toContain("OTO-42");
  expect(row.querySelector("button[aria-label^='Base branch']")).not.toBeNull();
  expect(
    row.querySelector("[data-testid='execution-picker'][data-label='Workflow']"),
  ).not.toBeNull();
});

it("leaves a step with its own override only, repeating no global control", async () => {
  await openWorkflow();
  const card = stepCard();

  expect(card.querySelector("[data-testid='execution-picker'][data-level='step']")).not.toBeNull();
  expect(card.querySelector("button[aria-label^='Base branch']")).toBeNull();
  expect(card.textContent).not.toContain("Presets");
  expect(card.textContent).not.toContain("OTO-42");
});

it("rescopes an inherited node when the global agent changes, and leaves an explicit one alone", async () => {
  await openWorkflow();
  await click("Add step");

  await click("pick opus for Step 1");
  await click("pick codex for Step 2");
  expect(lastPickerValue("Step 1")).toEqual({
    agent: null,
    options: {},
    model: { kind: "model", id: "opus" },
  });

  await click("pick codex for Workflow");

  expect(lastPickerValue("Step 1")).toEqual(EMPTY_EXECUTION_SELECTION);
  expect(lastPickerValue("Step 2")).toEqual({ agent: "runtime:codex", options: {} });
});
