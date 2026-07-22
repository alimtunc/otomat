// @vitest-environment happy-dom
import type { CreateIssueRequest, RuntimeDescriptor } from "@otomat/domain";
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";

const start = vi.fn(async () => false);
const create = vi.fn(async (_request: CreateIssueRequest) => true);
let runtimesData: RuntimeDescriptor[] = [];
const agentSelectProps = vi.fn();

interface AgentSelectProbeProps {
  value: string | null;
  ariaLabel?: string;
  compact?: boolean;
}

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

vi.mock("@web/api/agent-profiles/queries", () => ({
  useAgentProfiles: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

vi.mock("@web/components/runs/launch/launch-agent-select", () => ({
  LaunchAgentSelect: (props: AgentSelectProbeProps) => {
    agentSelectProps(props);
    return (
      <div
        data-testid="agent-select"
        data-aria-label={props.ariaLabel ?? "Agent"}
        data-compact={props.compact || undefined}
      />
    );
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
    provider_options: [],
  };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  start.mockClear();
  create.mockClear();
  agentSelectProps.mockClear();
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
    expect(agentSelectProps).toHaveBeenCalledWith(
      expect.objectContaining({ value: "runtime:codex" }),
    );
  });

  it("blocks launch with an actionable empty state when no runtime is launchable", async () => {
    runtimesData = [
      runtimeDescriptor("claude", "real", false),
      runtimeDescriptor("codex", "real", false),
    ];
    await renderDialog();
    expect(document.body.textContent).toContain("No agent runtime available");
    expect(buttonByText("Create & launch⌘↵").disabled).toBe(true);
    expect(document.querySelector("[data-testid='agent-select']")).toBeNull();
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
      buttonByText("Create & launch⌘↵").click();
    });

    expect(start).toHaveBeenCalledWith({
      prompt: "implement the thing",
      project_id: "p1",
      runtime: "claude",
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
    expect(document.querySelector("[data-aria-label='Candidate A agent']")).not.toBeNull();
    expect(document.querySelector("[data-aria-label='Candidate B agent']")).not.toBeNull();
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
      project_id: "p1",
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

  it("gives workflow agent selectors the standard control size", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog();
    await act(async () => buttonByText("Workflow").click());

    const stepAgent = document.querySelector<HTMLElement>("[data-aria-label='Step 1 agent']");
    const stepCall = agentSelectProps.mock.calls.find(
      ([props]: [AgentSelectProbeProps]) => props.ariaLabel === "Step 1 agent",
    );

    expect(stepCall?.[0].compact).not.toBe(true);
    expect(stepAgent?.parentElement?.classList.contains("w-52")).toBe(true);
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

  it("blocks an agent launch when no project is selected", async () => {
    runtimesData = [runtimeDescriptor("claude", "real", true)];
    await renderDialog(() => undefined, { withProject: false });

    expect(buttonByText("Create & launch⌘↵").disabled).toBe(true);
    expect(document.body.textContent).toContain("Select a project before launching a run.");
    expect(start).not.toHaveBeenCalled();
  });
});
