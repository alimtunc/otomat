// @vitest-environment happy-dom
import type { CreateIssueRequest, RunContract, RuntimeDescriptor } from "@otomat/domain";
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { executionDefaultsQueryResult } from "#support/execution-defaults";
import { referencedIssue } from "#support/issue";
import {
  repositoriesQueryResult,
  repository,
  repositoryBranchesErrorResult,
  repositoryBranchesQueryResult,
} from "#support/launch-target";
import { modelCatalogQueryResult } from "#support/runtime-models";
import { providerOptionSetQueryResult } from "#support/runtime-options";

const launch = vi.fn(async () => ({ id: "run-1" }) as RunContract);
const navigate = vi.fn();
const create = vi.fn(async (_request: CreateIssueRequest) => true);
let runtimesData: RuntimeDescriptor[] = [];
let repositories = [repository()];
let branchesFailed = false;
const pickerProps = vi.fn();

interface ExecutionPickerProbeProps {
  level: string;
  value: { agent: string | null };
  label: string;
  compact?: boolean;
}

vi.mock("@web/api/runs/use-launch-run", () => ({
  useLaunchRun: () => ({ launch, isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

vi.mock("@web/api/issues/mutations", () => ({
  useCreateIssueAndNavigate: () => ({ create, isPending: false }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimes: () => ({
    data: runtimesData,
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
  useRuntimeModels: () => modelCatalogQueryResult(),
  useRuntimeProviderOptions: () => providerOptionSetQueryResult(),
  useExecutionDefaults: () => executionDefaultsQueryResult(),
  useRepositories: () => repositoriesQueryResult(repositories),
  useRepositoryBranches: () =>
    branchesFailed ? repositoryBranchesErrorResult() : repositoryBranchesQueryResult(),
  useRepositoryFiles: () => ({ data: { paths: [], omitted: 0 }, isPending: false, isError: false }),
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
  useProjectIssues: () => ({ data: [REFERENCED], isPending: false, isError: false }),
}));

vi.mock("@web/components/execution/execution-config-picker", () => ({
  ExecutionConfigPicker: (props: ExecutionPickerProbeProps) => {
    pickerProps(props);
    return <div data-testid="execution-picker" data-level={props.level} data-label={props.label} />;
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const REFERENCED = referencedIssue();

function runtimeDescriptor(
  id: string,
  kind: RuntimeDescriptor["kind"],
  available: boolean,
): RuntimeDescriptor {
  return {
    id,
    display_name: id,
    kind,
    capabilities: {
      stream: true,
      steering: "turn_boundary",
      abort: true,
      resume: true,
      permissions: false,
      diff_hints: false,
    },
    availability: available
      ? { status: "available", version: null }
      : { status: "unavailable", reason: "binary_not_found" },
  };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  launch.mockClear();
  navigate.mockClear();
  create.mockClear();
  pickerProps.mockClear();
  runtimesData = [];
  repositories = [repository()];
  branchesFailed = false;
});

async function renderDialog(
  onOpenChange: (open: boolean) => void = () => undefined,
  options: { withProject?: boolean } = {},
) {
  const projectId = (options.withProject ?? true) ? "p1" : undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(
      <NewIssueDialog
        open
        onOpenChange={onOpenChange}
        projectId={projectId}
        projectName="otomat"
      />,
    );
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
  });
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`button "${text}" not found`);
  return button;
}

/** The composer's actions are icon-only, so their name is only in `aria-label`. */
function buttonByLabel(prefix: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label^='${prefix}']`);
  if (!button) throw new Error(`button labelled "${prefix}" not found`);
  return button;
}

/** Result rows compose an identifier and a title, so they are matched on a fragment. */
function buttonContaining(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!button) throw new Error(`button containing "${text}" not found`);
  return button;
}

function setTextareaValue(input: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("NewIssueDialog", () => {
  it("offers both the Manual and With agent modes", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();
    const labels = [...document.querySelectorAll("button")].map((button) =>
      button.textContent?.trim(),
    );
    expect(labels).toContain("Manual");
    expect(labels).toContain("With agent");
    expect(buttonByLabel("Create & launch")).not.toBeNull();
  });

  it("auto-selects the first available real runtime in agent mode", async () => {
    runtimesData = [
      runtimeDescriptor("claude", "real", false),
      runtimeDescriptor("codex", "real", true),
      runtimeDescriptor("fake", "simulated", true),
    ];
    await renderDialog();
    expect(pickerProps).toHaveBeenCalledWith(
      expect.objectContaining({ value: expect.objectContaining({ agent: "runtime:codex" }) }),
    );
  });

  it("blocks launch with an actionable empty state when no runtime is launchable", async () => {
    runtimesData = [
      runtimeDescriptor("claude", "real", false),
      runtimeDescriptor("codex", "real", false),
    ];
    await renderDialog();
    expect(document.body.textContent).toContain("No agent runtime available");
    expect(buttonByLabel("Create & launch").disabled).toBe(true);
    expect(document.querySelector("[data-testid='execution-picker']")).toBeNull();
  });

  it("creates a manual issue for the current project and closes", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    const onOpenChange = vi.fn();
    await renderDialog(onOpenChange);

    await act(async () => {
      buttonByText("Manual").click();
    });
    const title = document.querySelector<HTMLInputElement>("input[aria-label='Issue title']");
    expect(title).not.toBeNull();
    await act(async () => {
      setInputValue(title!, "Ship the CSV parser");
    });
    await act(async () => {
      buttonByText("Create issue").click();
    });

    expect(create).toHaveBeenCalledWith({ project_id: "p1", title: "Ship the CSV parser" });
    expect(launch).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pins an agent launch to the current project with the resolved runtime", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();

    const prompt = document.querySelector<HTMLTextAreaElement>(
      "textarea[aria-label='Issue prompt']",
    );
    expect(prompt).not.toBeNull();
    if (!prompt) throw new Error("issue prompt not found");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(prompt, "implement the thing");
      prompt.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      buttonByLabel("Create & launch").click();
    });

    expect(launch).toHaveBeenCalledWith({
      prompt: "implement the thing",
      project_id: "p1",
      base_branch: "main",
      runtime: "claude",
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/runs/$runId", params: { runId: "run-1" } });
  });

  it("builds a valid compete group and explains that dependents wait for the winner", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();

    await act(async () => buttonByText("Workflow").click());
    await act(async () => buttonByText("Add compete group").click());
    const removeInitial = document.querySelector<HTMLButtonElement>(
      "button[aria-label='Remove step 1']",
    );
    if (!removeInitial) throw new Error("initial workflow step remove button not found");
    await act(async () => removeInitial.click());

    const goal = document.querySelector<HTMLTextAreaElement>(
      "textarea[aria-label='Workflow goal']",
    );
    const objective = document.querySelector<HTMLInputElement>(
      "input[aria-label='Compete group 1 objective']",
    );
    const candidateNames = [
      ...document.querySelectorAll<HTMLInputElement>(
        "input[aria-label^='Candidate '][aria-label$=' name']",
      ),
    ];
    const candidateNotes = [
      ...document.querySelectorAll<HTMLTextAreaElement>(
        "textarea[aria-label^='Candidate '][aria-label$=' instructions']",
      ),
    ];
    expect(candidateNames).toHaveLength(2);
    expect(candidateNotes).toHaveLength(2);
    expect(
      document.querySelector("[data-testid='execution-picker'][data-label='Candidate A']"),
    ).not.toBeNull();
    expect(
      document.querySelector("[data-testid='execution-picker'][data-label='Candidate B']"),
    ).not.toBeNull();
    expect(document.body.textContent).toContain(
      "Steps that depend on this group stay queued until you compare the results and select a winner.",
    );

    await act(async () => {
      setTextareaValue(goal!, "Choose the implementation");
      setInputValue(objective!, "Implement the feature");
      setInputValue(candidateNames[0]!, "Direct");
      setInputValue(candidateNames[1]!, "Layered");
      setTextareaValue(candidateNotes[0]!, "Implement directly");
      setTextareaValue(candidateNotes[1]!, "Implement behind a boundary");
    });
    await act(async () => buttonByText("Launch workflow⌘↵").click());

    expect(launch).toHaveBeenCalledWith({
      prompt: "Choose the implementation",
      project_id: "p1",
      base_branch: "main",
      runtime: "claude",
      plan: {
        version: 1,
        steps: [
          {
            id: "compete-2",
            name: "Implement the feature",
            depends_on: [],
            compete: [
              {
                id: "compete-2-candidate-1",
                name: "Direct",
                agent: null,
                note: "Implement directly",
              },
              {
                id: "compete-2-candidate-2",
                name: "Layered",
                agent: null,
                note: "Implement behind a boundary",
              },
            ],
          },
        ],
      },
    });
    // The workflow created its own issue, so the run is nowhere on screen yet.
    expect(navigate).toHaveBeenCalledWith({ to: "/runs/$runId", params: { runId: "run-1" } });
  });

  it("compacts the per-step execution control and leaves the run-level one full size", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();
    await act(async () => buttonByText("Workflow").click());

    const calls = pickerProps.mock.calls.map(([props]: [ExecutionPickerProbeProps]) => props);
    expect(calls.find((props) => props.label === "Workflow")?.compact).not.toBe(true);
    expect(calls.find((props) => props.label === "Step 1")?.compact).toBe(true);
  });

  it("uses the iris interaction color for selected workflow dependencies", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();
    await act(async () => buttonByText("Workflow").click());
    await act(async () => buttonByText("Add step").click());

    const dependency = buttonByText("Step 1");
    await act(async () => dependency.click());

    expect(dependency.getAttribute("aria-pressed")).toBe("true");
    expect(dependency.classList.contains("bg-iris-subtle")).toBe(true);
    expect(dependency.classList.contains("text-iris-text")).toBe(true);
  });

  it("keeps the workflow shortcut legible on the primary action", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();
    await act(async () => buttonByText("Workflow").click());

    const shortcut = buttonByText("Launch workflow⌘↵").querySelector("kbd");

    expect(shortcut?.classList.contains("bg-on-accent/15")).toBe(true);
    expect(shortcut?.classList.contains("text-on-accent")).toBe(true);
  });

  it("uses the workflow glyph for compete groups", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();
    await act(async () => buttonByText("Workflow").click());

    const addCompeteGroup = buttonByText("Add compete group");
    expect(addCompeteGroup.querySelector(".lucide-workflow")).not.toBeNull();
  });

  it("uses an informational notice for compete groups", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();
    await act(async () => buttonByText("Workflow").click());

    await act(async () => buttonByText("Add compete group").click());
    const notice = [...document.querySelectorAll("p")].find((element) =>
      element.textContent?.startsWith("Steps that depend on this group"),
    );

    expect(notice?.classList.contains("bg-iris-subtle")).toBe(true);
    expect(notice?.classList.contains("text-text-secondary")).toBe(true);
  });

  it("gives the composer the dialog, with no static Repository section to occupy it", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();

    // The project header already names the repository; a resolved single one is not a decision.
    expect(document.body.textContent).not.toContain("Repository");
    expect(document.querySelector("textarea[aria-label='Issue prompt']")).not.toBeNull();
  });

  it("reaches execution, context and the base branch from the toolbar without covering the prompt", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();

    expect(document.querySelector("[data-testid='execution-picker']")).not.toBeNull();
    expect(buttonByLabel("Add context")).not.toBeNull();
    expect(document.querySelector("button[aria-label^='Base branch']")).not.toBeNull();
    expect(document.querySelector("textarea[aria-label='Issue prompt']")).not.toBeNull();
  });

  it("names an issue attached here by its public identifier, never by its internal id", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();

    await act(async () => buttonByLabel("Add context").click());
    await act(async () => buttonContaining("Ship the CSV parser").click());

    const chips = document.querySelector("[role='list'][aria-label='Ad-hoc run context']");
    expect(chips?.textContent).toContain("OTO-42");
    expect(document.body.textContent).not.toContain(REFERENCED.id.slice(0, 8));
  });

  it("spends the row on icons, keeping each action named and its shortcut on the tooltip", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();

    const add = buttonByLabel("Add context");
    const action = buttonByLabel("Create & launch");

    expect(add.textContent).toBe("");
    expect(add.getAttribute("title")).toBe("Add context");
    expect(action.textContent).toBe("");
    expect(action.getAttribute("aria-label")).toBe("Create & launch — write a prompt first");
    expect(action.getAttribute("title")).toContain("⌘↵");
    expect(action.disabled).toBe(true);
  });

  it("sends on ⌘↵ like a composer, not only from the button", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();

    const prompt = document.querySelector<HTMLTextAreaElement>(
      "textarea[aria-label='Issue prompt']",
    );
    if (!prompt) throw new Error("issue prompt not found");
    await act(async () => setTextareaValue(prompt, "implement the thing"));
    await act(async () => {
      prompt.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ prompt: "implement the thing" }));
  });

  it("keeps a long prompt inside a bounded composer instead of growing the dialog", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();

    const prompt = document.querySelector<HTMLTextAreaElement>(
      "textarea[aria-label='Issue prompt']",
    );
    if (!prompt) throw new Error("issue prompt not found");
    await act(async () => setTextareaValue(prompt, "context line\n".repeat(80)));

    const bounded = prompt.closest(".overflow-y-auto");
    expect(bounded?.className).toContain("max-h-64");
    // The textarea itself never scrolls; the composer that holds it does.
    expect(prompt.className).toContain("overflow-hidden");
  });

  it("says the branches could not be read, where a disabled control's tooltip never would", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    branchesFailed = true;
    await renderDialog();

    const alert = document.querySelector("[role='alert']");
    expect(alert?.textContent).toContain("Could not read this repository's branches");
    expect(document.querySelector("button[aria-label^='Base branch']")).not.toBeNull();
  });

  it("refuses to pick a repository when the project resolves several", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    repositories = [
      repository(),
      repository({ id: "repo-2", name: "otomat-docs", default_branch: "trunk" }),
    ];
    await renderDialog();

    expect(document.body.textContent).toContain("Which repository should this run work in?");
    expect(document.querySelector("textarea[aria-label='Issue prompt']")).toBeNull();

    await act(async () => buttonByText("otomat-docs").click());

    expect(document.querySelector("textarea[aria-label='Issue prompt']")).not.toBeNull();
  });

  it("closes on Escape without creating anything", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    const onOpenChange = vi.fn();
    await renderDialog(onOpenChange);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onOpenChange.mock.calls.at(0)?.at(0)).toBe(false);
    expect(launch).not.toHaveBeenCalled();
  });

  it("blocks an agent launch before the form exists when no project is selected", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog(() => undefined, { withProject: false });

    expect(document.body.textContent).toContain("No project selected");
    expect(document.querySelector("textarea")).toBeNull();
    expect(launch).not.toHaveBeenCalled();
  });
});
