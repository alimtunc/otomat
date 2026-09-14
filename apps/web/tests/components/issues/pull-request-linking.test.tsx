// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { IssuePullRequests } from "@otomat/domain";
import { IssuePullRequestsSection } from "@web/components/issues/workspace/rail/issue-pull-requests-section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mountWithQuery, type Mounted } from "#support/mount";
import { pullRequest } from "#support/pull-request";

const empty: IssuePullRequests = {
  attached: [],
  candidates: [],
  detection: { status: "searched", message: "No pull request names this issue." },
};
const list = vi.fn(async (): Promise<IssuePullRequests> => empty);
const attach = vi.fn(async (_issueId: string, _request: unknown) =>
  pullRequest({ issue_id: "issue-1" }),
);

vi.mock("@web/api/client", () => ({
  daemon: {
    listIssuePullRequests: () => list(),
    attachPullRequest: (issueId: string, request: unknown) => attach(issueId, request),
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: () => <a>Review diff</a>,
}));

let mounted: Mounted;

afterEach(async () => {
  await mounted.cleanup();
  vi.clearAllMocks();
  list.mockImplementation(async () => empty);
});

async function openForm() {
  mounted = await mountWithQuery(<IssuePullRequestsSection issueId="issue-1" />);
  await act(async () => findButton("Link a pull request")?.click());
  const input = mounted.container.querySelector("input");
  if (input === null) throw new Error("Link form is missing its field");
  return input;
}

it("opens an inline labelled form and cancels without linking anything", async () => {
  const input = await openForm();
  expect(mounted.container.querySelector("label")?.textContent).toBe("PR number or URL");
  expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
  expect(findButton("Link pull request")?.disabled).toBe(true);
  await act(async () => setInputValue(input, "#128"));
  await act(async () => findButton("Cancel")?.click());
  expect(mounted.container.querySelector("input")).toBeNull();
  expect(document.activeElement).toBe(findButton("Link a pull request"));
  expect(attach).not.toHaveBeenCalled();
});

it("shows the newly linked PR before the refresh answers and closes the form", async () => {
  const input = await openForm();
  list.mockImplementation(() => new Promise(() => {}));
  await act(async () => setInputValue(input, "  #142  "));
  await act(async () => findButton("Link pull request")?.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(attach).toHaveBeenCalledWith("issue-1", { reference: "#142" });
  expect(mounted.container.textContent).toContain("#142 Vendor anti-slop");
  expect(mounted.container.textContent).not.toContain("No linked pull request");
  expect(mounted.container.querySelector("input")).toBeNull();
  expect(document.activeElement).toBe(findButton("Link another pull request"));
});

it("keeps the reference and a useful refusal visible when linking fails", async () => {
  attach.mockRejectedValueOnce(
    new DaemonRequestError(409, "POST", "/api/issues/issue-1/pull-requests", {
      error: "pr_repository_mismatch",
      message: "This PR belongs to another repository.",
    }),
  );
  const input = await openForm();
  await act(async () => setInputValue(input, "#128"));
  await act(async () => findButton("Link pull request")?.click());
  expect(input.value).toBe("#128");
  expect(mounted.container.querySelector('[role="alert"]')?.textContent).toBe(
    "This PR belongs to another repository.",
  );
  expect(findButton("Link pull request")?.disabled).toBe(false);
  expect(findButton("Link a pull request")?.getAttribute("aria-expanded")).toBe("true");
});
