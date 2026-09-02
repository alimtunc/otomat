// @vitest-environment happy-dom
import type {
  MergePullRequestRequest,
  PullRequestMergeAvailability,
  PullRequestOverview,
} from "@otomat/domain";
import { PullRequestMergePanel } from "@web/components/pull-requests/overview/merge-panel";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";
import { pullRequestOverview } from "#support/pull-request-overview";

const merges: MergePullRequestRequest[] = [];
let settle: (() => void) | null = null;

vi.mock("@web/api/client", () => ({
  daemon: {
    mergePullRequest: (_id: string, request: MergePullRequestRequest) => {
      merges.push(request);
      return new Promise((resolve) => {
        settle = () => resolve(pullRequestOverview());
      });
    },
  },
}));

const confirmButton = () =>
  [...document.body.querySelectorAll("button")]
    .filter((button) => button.textContent?.trim() === "Squash and merge")
    .at(-1);

function overview(merge: PullRequestMergeAvailability): PullRequestOverview {
  return pullRequestOverview({ merge });
}

function panel(merge: PullRequestMergeAvailability) {
  merges.length = 0;
  settle = null;
  return mountWithQuery(<PullRequestMergePanel overview={overview(merge)} />);
}

it("offers no merge and explains why on a pull request Otomat has no authority over", async () => {
  const mounted = await panel({
    methods: [],
    blocker: "not_authorized",
    reason: "Otomat does not own contrib/fix and you did not open this pull request.",
  });

  expect(document.body.textContent).toContain("Otomat does not own contrib/fix");
  expect(findButton("Merge")).toBeUndefined();
  expect(findButton("Squash and merge")).toBeUndefined();
  await mounted.cleanup();
});

it("explains running checks instead of offering a merge that would be refused", async () => {
  const mounted = await panel({
    methods: [],
    blocker: "checks_pending",
    reason: "Checks are still running on this pull request.",
  });

  expect(document.body.textContent).toContain("Checks are still running");
  expect(findButton("Merge")).toBeUndefined();
  await mounted.cleanup();
});

it("offers only the methods the repository allows", async () => {
  const mounted = await panel({ methods: ["squash"], blocker: null, reason: "Ready to merge." });

  expect(findButton("Merge")).toBeUndefined();
  expect(findButton("Squash and merge")).toBeDefined();
  await mounted.cleanup();
});

it("merges only after a confirmation naming the method, the head and the base", async () => {
  const mounted = await panel({ methods: ["merge", "squash"], blocker: null, reason: "Ready." });

  await act(async () => {
    findButton("Squash and merge")?.click();
  });
  expect(merges).toEqual([]);
  const dialog = document.body.textContent ?? "";
  expect(dialog).toContain("contrib/fix");
  expect(dialog).toContain("main");
  expect(dialog).toContain("squashes the branch into one commit");

  await act(async () => {
    confirmButton()?.click();
  });
  expect(merges).toEqual([{ method: "squash" }]);
  await mounted.cleanup();
});

it("refuses a second merge while the first is still in flight, dialog closed or not", async () => {
  const mounted = await panel({ methods: ["squash"], blocker: null, reason: "Ready to merge." });

  await act(async () => {
    findButton("Squash and merge")?.click();
  });
  await act(async () => {
    confirmButton()?.click();
  });
  expect(merges).toEqual([{ method: "squash" }]);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(confirmButton()?.disabled).toBe(true);

  await act(async () => {
    findButton("Keep it open")?.click();
  });
  expect(findButton("Squash and merge")?.disabled).toBe(true);

  await act(async () => {
    findButton("Squash and merge")?.click();
  });
  expect(merges).toEqual([{ method: "squash" }]);

  await act(async () => {
    settle?.();
  });
  await mounted.cleanup();
});
