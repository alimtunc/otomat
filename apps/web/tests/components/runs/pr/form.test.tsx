// @vitest-environment happy-dom
import {
  projectPullRequestPublicationOperation,
  type PublishPullRequestRequest,
  type PullRequestContract,
  type PullRequestProposal,
  type PullRequestPublishability,
} from "@otomat/domain";
import { PullRequestForm } from "@web/components/runs/pr/form";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";

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
};

const PROPOSAL: PullRequestProposal = {
  subject: { type: "feat", scope: "pr", summary: "publish in one action" },
  body: "Publishes the run in one click.\n\nFixes OTO-81",
  branch: "feat/compact-pr",
  commit_body: null,
  generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(overrides: Partial<Parameters<typeof PullRequestForm>[0]> = {}) {
  const onSubmit = vi.fn(async (_request: PublishPullRequestRequest) => true);
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
        operation={null}
        publishability={PUBLISHABLE}
        connected
        customize={false}
        onCustomizeChange={onCustomizeChange}
        chosenMode={undefined}
        onModeChange={onModeChange}
        onSubmit={onSubmit}
        onGenerate={onGenerate}
        generationRefusal={null}
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

function click(label: string): void {
  const target = button(label);
  act(() => target.click());
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function summaryInput(view: HTMLElement): HTMLInputElement {
  const found = [...view.querySelectorAll("input")].find(
    (input) => input.placeholder === "unify run and workflow composers",
  );
  if (!found) throw new Error("no summary input");
  return found;
}

function button(label: string): HTMLButtonElement {
  const found = findButton(label);
  if (!found) throw new Error(`no button labelled ${label}`);
  return found;
}

function pullRequest(overrides: Partial<PullRequestContract> = {}): PullRequestContract {
  return {
    id: "pr1",
    run_id: "run-1",
    provider: "github",
    number: null,
    url: null,
    status: "draft",
    publication_status: "not_configured",
    title: "feat(pr): ship it",
    body: "Details",
    head_ref: "feat/compact-pr",
    base_ref: null,
    commit_subject: "feat(pr): ship it",
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
  it("keeps the advanced inputs and the generator out of the compact form", () => {
    const { view } = render();

    expect(view.querySelector("textarea")?.closest("[hidden]")).not.toBeNull();
    expect(view.querySelector("input")?.closest("[hidden]")).not.toBeNull();
    expect(button("Generate title & description with AI").closest("[hidden]")).not.toBeNull();
    expect(view.textContent).toContain("Customize PR");
    expect(button("Create PR").closest("[hidden]")).toBeNull();
    expect(view.textContent).not.toContain("PR with AI");
  });

  it("reveals the advanced inputs with the stored subject read back into its fields", () => {
    const { view } = render({ customize: true, pullRequest: pullRequest() });

    const inputs = [...view.querySelectorAll("input")].map((input) => input.value);
    expect(inputs).toContain("pr");
    expect(inputs).toContain("ship it");
    expect(inputs).toContain("feat/compact-pr");
    expect(view.querySelector("textarea")?.value).toBe("Details");
  });

  it("creates the pull request from the present metadata without generating", async () => {
    const { onGenerate, onSubmit } = render({ pullRequest: pullRequest() });

    click("Create PR");
    await act(async () => {});

    expect(onGenerate).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "draft",
      details: {
        subject: { type: "feat", scope: "pr", summary: "ship it" },
        body: "Details",
        head_ref: "feat/compact-pr",
      },
    });
  });

  it("republishes stored metadata rather than paying the generator twice", async () => {
    const row = pullRequest({ publication_status: "failed", error_code: "github_push_failed" });
    const { view, onGenerate, onSubmit } = render({
      pullRequest: row,
      operation: projectPullRequestPublicationOperation(row.id, {
        publication_status: row.publication_status,
        failed_phase: "pushing",
        error_code: row.error_code,
        error_message: row.error_message,
        updated_at: "2026-09-14T09:00:00.000Z",
      }),
    });

    expect(view.textContent).toContain("Creation failed");
    click("Create PR");
    await act(async () => {});

    expect(onGenerate).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          subject: { type: "feat", scope: "pr", summary: "ship it" },
        }),
      }),
    );
  });

  it("fills the subject fields from a generation that publishes nothing", async () => {
    const { view, onSubmit } = render({ customize: true });

    click("Generate title & description with AI");
    await act(async () => {});

    expect(onSubmit).not.toHaveBeenCalled();
    const inputs = [...view.querySelectorAll("input")].map((input) => input.value);
    expect(inputs).toContain(PROPOSAL.subject.scope);
    expect(inputs).toContain(PROPOSAL.subject.summary);
    expect(view.querySelector("textarea")?.value).toBe(PROPOSAL.body);
  });

  it("publishes the generated metadata only once the operator has edited and confirmed it", async () => {
    const { view, onSubmit } = render({ customize: true });

    click("Generate title & description with AI");
    await act(async () => {});
    act(() => {
      setInputValue(summaryInput(view), "publish after a human edit");
    });
    click("Create PR");
    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "ready",
      details: {
        subject: { type: "feat", scope: "pr", summary: "publish after a human edit" },
        body: PROPOSAL.body,
        head_ref: PROPOSAL.branch,
      },
    });
  });

  it("keeps the label readable under the creation spinner", () => {
    render({ pullRequest: pullRequest(), isPending: true });

    const create = button("Create PR");
    expect(create.disabled).toBe(true);
    expect(create.getAttribute("aria-busy")).toBe("true");
    expect(create.dataset.loading).toBeUndefined();
    expect(create.querySelector('[data-slot="spinner"]')).not.toBeNull();
  });

  it("refuses to publish a subject nobody filled in", async () => {
    const { view, onSubmit } = render({ customize: true });

    click("Create PR");
    await act(async () => {});

    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.textContent).toContain("A summary is required.");
  });

  it("refuses to publish a summary the composed subject cannot hold", async () => {
    const { view, onSubmit } = render({ customize: true, pullRequest: pullRequest() });

    const summary = [...view.querySelectorAll("input")].find((input) => input.value === "ship it");
    if (!summary) throw new Error("no summary input");
    act(() => {
      setInputValue(summary, "x".repeat(80));
    });
    click("Create PR");
    await act(async () => {});

    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.textContent).toContain("72");
  });

  it("publishes the edited subject as one structured object", async () => {
    const { view, onSubmit } = render({ customize: true, pullRequest: pullRequest() });

    const summary = [...view.querySelectorAll("input")].find((input) => input.value === "ship it");
    if (!summary) throw new Error("no summary input");
    act(() => {
      setInputValue(summary, "validate the publication subject");
    });
    click("Create PR");
    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          subject: { type: "feat", scope: "pr", summary: "validate the publication subject" },
        }),
      }),
    );
  });

  it("publishes the operator's explicit draft choice from the advanced form", async () => {
    const { onSubmit } = render({
      customize: true,
      chosenMode: "draft",
      pullRequest: pullRequest(),
    });

    click("Create PR");
    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ mode: "draft" }));
  });

  it("recomputes the summary budget the moment the scope changes", () => {
    const { view } = render({ customize: true, pullRequest: pullRequest() });

    expect(view.textContent).toContain("leaving 62 for the summary");

    const scope = [...view.querySelectorAll("input")].find((input) => input.value === "pr");
    if (!scope) throw new Error("no scope input");
    act(() => {
      setInputValue(scope, "publication");
    });

    expect(view.textContent).toContain("leaving 53 for the summary");
    expect(view.textContent).toContain("limited to 72 characters");
    expect(summaryInput(view).value).toBe("ship it");
  });

  it("leaves a refused generation editable, with the refusal on the summary field", () => {
    const refusal = "The subject is 79 characters; remove 7 to stay within 72.";
    const { view } = render({
      customize: true,
      generationRefusal: refusal,
      pullRequest: pullRequest({ commit_subject: null }),
    });

    expect(view.textContent).toContain(refusal);
    expect(summaryInput(view).disabled).toBe(false);
    expect(view.textContent).toContain("Create PR");
  });

  it("opens the details on a refusal even while Customize is closed", () => {
    const { view } = render({
      customize: false,
      generationRefusal: "The subject is 79 characters; remove 7 to stay within 72.",
    });

    expect(summaryInput(view).closest("[hidden]")).toBeNull();
  });

  it("clears the refusal once the operator writes a summary of their own", () => {
    const refusal = "The subject is 79 characters; remove 7 to stay within 72.";
    const { view } = render({
      customize: true,
      generationRefusal: refusal,
      pullRequest: pullRequest({ commit_subject: null }),
    });

    expect(view.textContent).toContain(refusal);

    const summary = summaryInput(view);
    act(() => {
      setInputValue(summary, "keep the metadata the operator wrote");
    });

    expect(view.textContent).not.toContain(refusal);
    expect(summary.value).toBe("keep the metadata the operator wrote");
  });

  it("names the blocked publication and offers no creation", () => {
    const { view } = render({
      publishability: {
        ...PUBLISHABLE,
        blocker: { code: "diff_empty", message: "The workspace carries no change." },
      },
    });

    expect(view.textContent).toContain("Cannot publish");
    expect(button("Create PR").disabled).toBe(true);
  });
});
