// @vitest-environment happy-dom
import {
  projectPullRequestPublicationOperation,
  PUBLICATION_INTERRUPTED_CODE,
} from "@otomat/domain";
import { PullRequestProgress } from "@web/components/runs/pr/progress";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(operation: Parameters<typeof PullRequestProgress>[0]["operation"]): HTMLDivElement {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<PullRequestProgress operation={operation} />));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("PullRequestProgress", () => {
  it("renders nothing while no publication has been accepted", () => {
    expect(render(null).textContent).toBe("");
  });

  it("names the phase the daemon is in, whoever is watching", () => {
    const view = render(
      projectPullRequestPublicationOperation("pr1", {
        publication_status: "pushing",
        failed_phase: null,
        error_code: null,
        error_message: null,
        updated_at: "2026-08-20T09:00:00.000Z",
      }),
    );

    expect([...view.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "●Writing metadata",
      "●Committing the workspace",
      "Pushing the branch",
      "○Creating the pull request",
    ]);
    expect(view.querySelector("[aria-current='step']")?.textContent).toContain(
      "Pushing the branch",
    );
  });

  it("keeps showing the phase a stopped daemon left behind", () => {
    const view = render(
      projectPullRequestPublicationOperation("pr1", {
        publication_status: "failed",
        failed_phase: "creating",
        error_code: PUBLICATION_INTERRUPTED_CODE,
        error_message: "The GitHub publication stopped while creating the pull request.",
        updated_at: "2026-08-20T09:00:00.000Z",
      }),
    );

    expect(view.querySelector("[aria-current='step']")).toBeNull();
    expect(view.textContent).toContain("✕Creating the pull request");
  });
});
