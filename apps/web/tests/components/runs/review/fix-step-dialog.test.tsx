// @vitest-environment happy-dom
import type { RequestFixRequest } from "@otomat/domain";
import { ReviewFixStepDialog } from "@web/components/runs/review/fix-step-dialog";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { repositoriesQueryResult } from "#support/launch-target";
import { mount } from "#support/mount";

vi.mock("@web/api/daemon/queries", () => ({
  useRepositories: () => repositoriesQueryResult(),
  useRepositoryFiles: () => ({ data: { paths: [], omitted: 0 }, isPending: false, isError: false }),
}));

vi.mock("@web/api/issues/queries", () => ({
  useIssue: () => ({ data: null, isPending: false, isError: false }),
  useProjectIssues: () => ({ data: [], isPending: false, isError: false }),
}));

vi.mock("@web/components/execution/use-launch-execution", () => ({
  useLaunchExecution: () => ({ canLaunch: true, request: { runtime: "fake" } }),
}));

vi.mock("@web/components/execution/launch-execution-picker", () => ({
  LaunchExecutionPicker: () => null,
}));

function selectionStub(requestFix: ReviewSelection["requestFix"]): ReviewSelection {
  return {
    selectedIds: new Set(["c1", "c2"]),
    toggle: () => {},
    clear: () => {},
    requestFix,
    isFixPending: false,
  };
}

function instructionsField(): HTMLTextAreaElement {
  const field = document.body.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Fix step instructions"]',
  );
  if (field === null) throw new Error("no instructions field rendered");
  return field;
}

async function openDialog(requestFix: ReviewSelection["requestFix"]) {
  const mounted = await mount(
    <ReviewFixStepDialog selection={selectionStub(requestFix)} issueId="i1" disabled={false} />,
  );
  await act(async () => {
    findButton("Fix selected comments with AI")?.click();
  });
  return mounted;
}

async function type(field: HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      field,
      value,
    );
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("AI fix confirmation", () => {
  it("summarizes the selection and carries the global instruction with it", async () => {
    const requests: RequestFixRequest[] = [];
    const { cleanup } = await openDialog((request, onAppended) => {
      requests.push(request);
      onAppended();
    });

    expect(document.body.textContent).toContain("2 comments become a new step");
    await type(instructionsField(), "Keep the file ASCII-only.");
    await act(async () => {
      findButton("Add fix step")?.click();
    });

    expect(requests).toEqual([
      {
        comment_ids: ["c1", "c2"],
        name: "Fix review comments",
        note: "Keep the file ASCII-only.",
        runtime: "fake",
      },
    ]);
    await cleanup();
  });

  it("sends no instruction when the field is left empty", async () => {
    const requests: RequestFixRequest[] = [];
    const { cleanup } = await openDialog((request, onAppended) => {
      requests.push(request);
      onAppended();
    });

    await act(async () => {
      findButton("Add fix step")?.click();
    });

    expect(requests[0]).not.toHaveProperty("note");
    await cleanup();
  });

  it("creates no step when the operator cancels", async () => {
    const requestFix = vi.fn();
    const { cleanup } = await openDialog(requestFix);

    await type(instructionsField(), "Never mind.");
    await act(async () => {
      findButton("Cancel")?.click();
    });

    expect(requestFix).not.toHaveBeenCalled();
    expect(findButton("Add fix step")).toBeUndefined();
    await cleanup();
  });
});
