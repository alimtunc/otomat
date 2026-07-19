// @vitest-environment happy-dom
import type { CreateIssueRequest, RuntimeDescriptor } from "@otomat/domain";
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const start = vi.fn(async () => false);
const create = vi.fn(async (_request: CreateIssueRequest) => true);
let runtimesData: RuntimeDescriptor[] = [];
const runtimeSelectProps = vi.fn();

vi.mock("@web/api/runs/mutations", () => ({
  useStartRunAndNavigate: () => ({ start, isPending: false }),
}));

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
}));

vi.mock("@web/components/runs/launch/runtime-select", () => ({
  RuntimeSelect: (props: { value: string | null }) => {
    runtimeSelectProps(props);
    return <div data-testid="runtime-select" />;
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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
      send_message: true,
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
  start.mockClear();
  create.mockClear();
  runtimeSelectProps.mockClear();
  runtimesData = [];
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

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
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
    expect(document.body.textContent).toContain("Create & launch");
  });

  it("auto-selects the first available real runtime in agent mode", async () => {
    runtimesData = [
      runtimeDescriptor("claude", "real", false),
      runtimeDescriptor("codex", "real", true),
      runtimeDescriptor("fake", "simulated", true),
    ];
    await renderDialog();
    expect(runtimeSelectProps).toHaveBeenCalledWith(expect.objectContaining({ value: "codex" }));
  });

  it("blocks launch with an actionable empty state when no runtime is launchable", async () => {
    runtimesData = [
      runtimeDescriptor("claude", "real", false),
      runtimeDescriptor("codex", "real", false),
    ];
    await renderDialog();
    expect(document.body.textContent).toContain("No agent runtime available");
    expect(buttonByText("Create & launch⌘↵").disabled).toBe(true);
    expect(document.querySelector("[data-testid='runtime-select']")).toBeNull();
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
    expect(start).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pins an agent launch to the current project", async () => {
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
      buttonByText("Create & launch⌘↵").click();
    });

    expect(start).toHaveBeenCalledWith({
      prompt: "implement the thing",
      runtime: "claude",
      project_id: "p1",
    });
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
    const candidatePrompts = [
      ...document.querySelectorAll<HTMLTextAreaElement>(
        "textarea[aria-label^='Candidate '][aria-label$=' prompt']",
      ),
    ];
    expect(candidateNames).toHaveLength(2);
    expect(candidatePrompts).toHaveLength(2);
    expect(document.body.textContent).toContain(
      "Steps that depend on this group stay queued until you compare the results and select a winner.",
    );

    await act(async () => {
      setTextareaValue(goal!, "Choose the implementation");
      setInputValue(objective!, "Implement the feature");
      setInputValue(candidateNames[0]!, "Direct");
      setInputValue(candidateNames[1]!, "Layered");
      setTextareaValue(candidatePrompts[0]!, "Implement directly");
      setTextareaValue(candidatePrompts[1]!, "Implement behind a boundary");
    });
    await act(async () => buttonByText("Launch workflow⌘↵").click());

    expect(start).toHaveBeenCalledWith({
      prompt: "Choose the implementation",
      runtime: "claude",
      project_id: "p1",
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
                prompt: "Implement directly",
              },
              {
                id: "compete-2-candidate-2",
                name: "Layered",
                agent: null,
                prompt: "Implement behind a boundary",
              },
            ],
          },
        ],
      },
    });
  });

  it("blocks an agent launch when no project is selected", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog(() => undefined, { withProject: false });

    expect(buttonByText("Create & launch⌘↵").disabled).toBe(true);
    expect(document.body.textContent).toContain("Select a project before launching a run.");
    expect(start).not.toHaveBeenCalled();
  });
});
