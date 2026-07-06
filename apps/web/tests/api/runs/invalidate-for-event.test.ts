import type { EventEnvelope } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";
import { invalidateForEvent } from "@web/api/runs/invalidate-for-event";
import { expect, it, vi } from "vitest";

import { envelope } from "#support/envelope";

const event = (type: EventEnvelope["type"]): EventEnvelope => envelope({ type });

function fakeClient() {
  const keys: unknown[] = [];
  const client = {
    invalidateQueries: vi.fn(({ queryKey }: { queryKey: unknown }) => keys.push(queryKey)),
  } as unknown as QueryClient;
  return { client, keys };
}

it("invalidates only the diff cache on git.diff_updated", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, "run-1", event("git.diff_updated"));
  expect(keys).toEqual([queryKeys.runDiff("run-1")]);
});

it("invalidates the review cache on any review.* event", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, "run-1", event("review.comment_created"));
  invalidateForEvent(client, "run-1", event("review.comment_resolved"));
  expect(keys).toEqual([queryKeys.runReview("run-1"), queryKeys.runReview("run-1")]);
});

it("invalidates the PR cache on any pr.* event", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, "run-1", event("pr.created"));
  invalidateForEvent(client, "run-1", event("pr.updated"));
  expect(keys).toEqual([queryKeys.runPullRequest("run-1"), queryKeys.runPullRequest("run-1")]);
});

it("invalidates the run and run list on a lifecycle or reconcile event", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, "run-1", event("run.lifecycle"));
  expect(keys).toEqual([queryKeys.run("run-1"), queryKeys.runs]);
});

it("ignores runtime frames that carry no cross-cache consequence", () => {
  const { client } = fakeClient();
  invalidateForEvent(client, "run-1", event("runtime.log"));
  expect(client.invalidateQueries).not.toHaveBeenCalled();
});
