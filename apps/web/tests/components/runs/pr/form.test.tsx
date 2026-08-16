// @vitest-environment happy-dom
import type {
  PreparePullRequestRequest,
  PullRequestContract,
  PullRequestProposal,
  PullRequestPublishability,
} from "@otomat/domain";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const PUBLISHABLE: PullRequestPublishability = {
  blocker: null,
  repository: "acme/otomat",
  base_ref: "main",
  head_ref: "otomat/run/run-1",
  changed_files: 2,
  additions: 12,
  deletions: 3,
  dirty: true,
  convention: "conventional",
};

const PROPOSAL: PullRequestProposal = {
  title: "feat(pr): publish in one action (OTO-81)",
  body: "Publishes the run in one click.\n\nFixes OTO-81",
  branch: "feat/compact-pr",
  commit: { subject: "feat(pr): publish in one action", body: null },
  generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(overrides: Partial<Parameters<typeof PullRequestForm>[0]> = {}) {
  const onSubmit = vi.fn(async (_value: PreparePullRequestRequest) => true);
  const onGenerate = vi.fn(async (): Promise<PullRequestProposal | null> => PROPOSAL);
  const onModeChange = vi.fn();
  const onCustomizeChange = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <PullRequestForm
        pullRequest={null}
        publishability={PUBLISHABLE}
        connected
        customize={false}
        onCustomizeChange={onCustomizeChange}
        chosenMode={undefined}
        onModeChange={onModeChange}
        onSubmit={onSubmit}
        onGenerate={onGenerate}
        isPending={false}
        isGenerating={false}
        {...overrides}
      />,
    );
  });
  const view = container;
  if (view === null) throw new Error("render produced no container");
  return { view, onSubmit, onGenerate, onModeChange, onCustomizeChange };
}

function click(view: HTMLElement, label: string): void {
  const button = [...view.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`no button labelled ${label}`);
  act(() => button.click());
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function pullRequest(overrides: Partial<PullRequestContract> = {}): PullRequestContract {
  return {
    id: "pr1",
    run_id: "run-1",
    provider: "github",
    number: null,
    url: null,
    status: "draft",
    publication_status: "not_configured",
    title: "Ship it",
    body: "Details",
    head_ref: "feat/compact-pr",
    base_ref: null,
    commit_subject: null,
    commit_body: null,
    generator: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    ...overrides,
  };
}

describe("PullRequestForm", () => {
  it("keeps the advanced inputs out of the compact form", () => {
    const { view } = render();

    expect(view.querySelector("textarea")).toBeNull();
    expect(view.querySelector("input")).toBeNull();
    expect(view.textContent).toContain("Customize PR");
    expect(view.textContent).toContain("Create PR with AI");
  });

  it("reveals the advanced inputs without losing the current proposal", () => {
    const { view } = render({ customize: true, pullRequest: pullRequest() });

    const inputs = [...view.querySelectorAll("input")].map((input) => input.value);
    expect(inputs).toContain("Ship it");
    expect(inputs).toContain("feat/compact-pr");
    expect(view.querySelector("textarea")?.value).toBe("Details");
  });

  it("generates and publishes ready for review in one action", async () => {
    const { view, onGenerate, onSubmit } = render();

    click(view, "Create PR with AI");
    await act(async () => {});

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      title: PROPOSAL.title,
      body: PROPOSAL.body,
      head_ref: PROPOSAL.branch,
      mode: "ready",
    });
  });

  it("publishes nothing when the generation failed, and leaves the fields editable", async () => {
    const onGenerate = vi.fn(async (): Promise<PullRequestProposal | null> => null);
    const { view, onSubmit } = render({ onGenerate });

    click(view, "Create PR with AI");
    await act(async () => {});

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("fills the fields from a generation that publishes nothing", async () => {
    const { view, onSubmit } = render({ customize: true });

    click(view, "Generate title & description with AI");
    await act(async () => {});

    expect(onSubmit).not.toHaveBeenCalled();
    expect([...view.querySelectorAll("input")].map((input) => input.value)).toContain(
      PROPOSAL.title,
    );
  });

  it("publishes the operator's explicit draft choice from the advanced form", async () => {
    const { view, onSubmit } = render({
      customize: true,
      chosenMode: "draft",
      pullRequest: pullRequest(),
    });

    click(view, "Create draft PR");
    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "draft" }) as PreparePullRequestRequest,
    );
  });

  it("names the blocked publication and offers no creation", () => {
    const { view } = render({
      publishability: {
        ...PUBLISHABLE,
        blocker: { code: "diff_empty", message: "The workspace carries no change." },
      },
    });

    expect(view.textContent).toContain("Cannot publish");
    const create = [...view.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Create PR with AI"),
    );
    expect(create?.disabled).toBe(true);
  });
});
