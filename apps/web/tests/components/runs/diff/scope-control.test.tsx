// @vitest-environment happy-dom
import type { RunDiffScope, RunDiffScopeSelector } from "@otomat/domain";
import { DiffScopeControl } from "@web/components/runs/diff/scope/control";
import type { RunDiffStep } from "@web/lib/run/diff-steps";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { BRANCH_SCOPE } from "#support/diff-scope";
import { findLabelled } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

vi.mock("@web/components/runs/diff/scope/commit-submenu", () => ({
  DiffCommitSubmenu: () => null,
}));

interface PullRequestQuery {
  data: { pull_request: { number: number } | null } | undefined;
  isError: boolean;
  refetch: () => void;
}

const noPullRequestRead = (): PullRequestQuery => ({
  data: undefined,
  isError: false,
  refetch: vi.fn(),
});

let pullRequest: PullRequestQuery = noPullRequestRead();

vi.mock("@web/api/prs/queries", () => ({ useRunPullRequest: () => pullRequest }));

const STEPS: RunDiffStep[] = [
  { id: "s1", name: "Implement", number: 1, reconstructable: true },
  { id: "s2", name: "Review", number: 2, reconstructable: false },
];

let view: Mounted | null = null;
let chosen: RunDiffScopeSelector[] = [];

afterEach(async () => {
  await view?.cleanup();
  view = null;
  chosen = [];
  pullRequest = noPullRequestRead();
});

function menuItems(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>("[role^='menuitem']")];
}

function findMenuItemStartingWith(text: string): HTMLElement | undefined {
  return menuItems().find((item) => item.textContent?.startsWith(text));
}

async function openControl(
  scope: RunDiffScope,
  pullRequestNumber: number | null,
): Promise<Mounted> {
  pullRequest = {
    ...noPullRequestRead(),
    data: pullRequestNumber === null ? undefined : { pull_request: { number: pullRequestNumber } },
  };
  const mounted = await mount(
    <DiffScopeControl
      runId="run-1"
      scope={scope}
      steps={STEPS}
      onSelect={(selector) => chosen.push(selector)}
    />,
  );
  await act(async () => {
    document.body.querySelector<HTMLElement>("[aria-label^='Diff scope: ']")?.click();
  });
  return mounted;
}

it("offers the pull request only once the run has one", async () => {
  view = await openControl(BRANCH_SCOPE, 79);

  expect(findMenuItemStartingWith("Pull request #79")).toBeDefined();

  await view.cleanup();
  view = await openControl(BRANCH_SCOPE, null);

  expect(findMenuItemStartingWith("Pull request")).toBeUndefined();
});

it("names the branch and the base it is measured against on the trigger", async () => {
  view = await openControl({ ...BRANCH_SCOPE, base_ref: "release" }, null);

  expect(findLabelled("Diff scope: Branch · otomat/run/x")).toBeDefined();
  expect(findMenuItemStartingWith("Branch")).toBeDefined();
});

it("selects the pull request scope without touching the branch one", async () => {
  view = await openControl(BRANCH_SCOPE, 79);

  await act(async () => {
    findMenuItemStartingWith("Pull request")?.click();
  });

  expect(chosen).toEqual([{ kind: "pull_request" }]);
});

it("names the scope the daemon answered with, pull request number included", async () => {
  view = await mount(
    <DiffScopeControl
      runId="run-1"
      scope={{ kind: "pull_request", number: 79 }}
      steps={STEPS}
      onSelect={(selector) => chosen.push(selector)}
    />,
  );

  expect(findLabelled("Diff scope: Pull request #79")).toBeDefined();
});

it("says the pull request could not be read instead of dropping the choice", async () => {
  pullRequest = { ...noPullRequestRead(), isError: true };
  view = await mount(
    <DiffScopeControl
      runId="run-1"
      scope={BRANCH_SCOPE}
      steps={STEPS}
      onSelect={(selector) => chosen.push(selector)}
    />,
  );
  await act(async () => {
    document.body.querySelector<HTMLElement>("[aria-label^='Diff scope: ']")?.click();
  });

  expect(document.body.querySelector("[role='alert']")?.textContent).toContain("could not be read");
});

it("names a step by its number, and marks one without both boundaries unselectable", async () => {
  view = await openControl(
    { kind: "step", step_run_id: "s1", step_name: "Implement", step_number: 1 },
    null,
  );

  expect(findLabelled("Diff scope: Step 1 · Implement")).toBeDefined();
  await act(async () => {
    findLabelled("Step: 1. Implement")?.click();
  });

  expect(findMenuItemStartingWith("2. Review")?.getAttribute("aria-disabled")).toBe("true");

  await act(async () => {
    findMenuItemStartingWith("1. Implement")?.click();
  });

  expect(chosen).toEqual([{ kind: "step", step: "s1" }]);
});
