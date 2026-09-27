// @vitest-environment happy-dom
import type { PullRequestStackContext, PullRequestStackMember } from "@otomat/domain";
import { PullRequestStackSection } from "@web/components/pull-requests/stack-section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findLabelled } from "#support/dom-queries";
import { mountWithQuery, type Mounted } from "#support/mount";

const readStack = vi.fn();
vi.mock("@web/api/client", () => ({
  daemon: { getPullRequestStack: (id: string) => readStack(id) },
}));

const current: PullRequestStackMember = {
  number: 42,
  title: "API",
  url: "https://github.com/acme/app/pull/42",
  status: "open",
  head_ref: "api",
  base_ref: "types",
};
const checkedAt = "2026-09-26T00:00:00.000Z";

let mounted: Mounted | undefined;
afterEach(async () => {
  await mounted?.cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it("shows a declared stack and preserves it when GitHub stops answering", async () => {
  const data: PullRequestStackContext = {
    current,
    stack: { number: 7, base_ref: "main", members: [current] },
    checked_at: checkedAt,
  };
  readStack.mockResolvedValue(data);
  mounted = await mountWithQuery(<PullRequestStackSection pullRequestId="pr" />);
  expect(mounted.container.textContent).toContain("GitHub stack #7");
  expect(mounted.container.querySelector('[aria-current="true"]')?.getAttribute("href")).toBe(
    current.url,
  );
  readStack.mockRejectedValue(new Error("GitHub unavailable"));
  await act(async () => findLabelled("Refresh stack")?.click());
  await vi.waitFor(() => expect(mounted?.container.textContent).toContain("Couldn’t refresh"));
  expect(mounted.container.textContent).toContain("GitHub stack #7");
  expect(mounted.container.textContent).not.toContain("No stack declared");
});

it("labels a successful absence of native membership without inferring a stack from branches", async () => {
  readStack.mockResolvedValue({ current, stack: null, checked_at: checkedAt });
  mounted = await mountWithQuery(<PullRequestStackSection pullRequestId="pr" />);
  expect(mounted.container.textContent).toContain("No stack declared on GitHub");
  expect(mounted.container.textContent).toContain("api → types");
  expect(mounted.container.textContent).not.toContain("GitHub stack #");
});
