import type { EventEnvelope } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { hostKeys } from "@web/api/query-keys";
import { invalidateForEvent } from "@web/api/runs/invalidate-for-event";
import { expect, it, vi } from "vitest";

import { envelope } from "#support/envelope";

const local = hostKeys("local");

const event = (type: EventEnvelope["type"]): EventEnvelope => envelope({ type });

function fakeClient() {
  const keys: unknown[] = [];
  // SAFETY: invalidateForEvent only calls invalidateQueries with a query-key filter.
  const client = {
    invalidateQueries: vi.fn(async ({ queryKey }: { queryKey: unknown }) => {
      keys.push(queryKey);
    }),
  } as QueryClient;
  return { client, keys };
}

it("invalidates the diff cache and completion report on git.diff_updated", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, local, "run-1", event("git.diff_updated"));
  expect(keys).toEqual([
    local.runCompletionReport("run-1"),
    local.reviewDiff({ kind: "run", id: "run-1" }),
  ]);
});

it("invalidates the review cache on any review.* event", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, local, "run-1", event("review.comment_created"));
  invalidateForEvent(client, local, "run-1", event("review.comment_resolved"));
  expect(keys).toEqual([
    local.runCompletionReport("run-1"),
    local.reviewDetail({ kind: "run", id: "run-1" }),
    local.runCompletionReport("run-1"),
    local.reviewDetail({ kind: "run", id: "run-1" }),
  ]);
});

it("invalidates the PR, its diff, the issue and inbox caches on any pr.* event", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, local, "run-1", event("pr.created"));
  invalidateForEvent(client, local, "run-1", event("pr.updated"));
  const perEvent = [
    local.runCompletionReport("run-1"),
    local.runPullRequest("run-1"),
    local.reviewDiff({ kind: "run", id: "run-1" }, { kind: "pull_request" }),
    local.issues,
    local.reviews,
    local.inbox,
  ];
  expect(keys).toEqual([...perEvent, ...perEvent]);
});

it("refreshes the synced issue's Linear caches so the cockpit needs no navigation", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(
    client,
    local,
    "run-1",
    envelope({ type: "linear.lifecycle_synced", payload: { issue_id: "li" } }),
  );
  expect(keys).toEqual([
    local.runCompletionReport("run-1"),
    local.linearWriteback("li"),
    local.linearEditor("li"),
    local.linearComments("li"),
    local.issue("li"),
    local.issues,
  ]);
});

it("drops no cache for a Linear event that names no issue", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, local, "run-1", event("linear.status_published"));
  expect(keys).toEqual([local.runCompletionReport("run-1")]);
});

it("invalidates the run, run list, conversation, issue execution, review queue and inbox caches on a lifecycle or reconcile event", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, local, "run-1", event("run.lifecycle"));
  expect(keys).toEqual([
    local.run("run-1"),
    local.runs,
    local.runContributions("run-1"),
    local.issues,
    local.reviews,
    local.inbox,
  ]);
});

it("invalidates the completion report for runtime evidence", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, local, "run-1", event("runtime.log"));
  expect(keys).toEqual([local.runCompletionReport("run-1")]);
});

it("refreshes both usage reads on a reported turn, so the run and the dashboard move together", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, local, "run-1", event("runtime.usage"));
  expect(keys).toEqual([local.runCompletionReport("run-1"), local.runUsage("run-1"), local.usage]);
});

it("invalidates only the run's conversation on a contribution event", () => {
  const { client, keys } = fakeClient();
  invalidateForEvent(client, local, "run-1", event("run.contribution"));
  expect(keys).toEqual([local.runContributions("run-1")]);
});
