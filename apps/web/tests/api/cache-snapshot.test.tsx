// @vitest-environment happy-dom
import type { IssueContract } from "@otomat/domain";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  attachQuerySnapshot,
  restoreQuerySnapshot,
  saveQuerySnapshot,
} from "@web/api/cache-snapshot";
import { hostKeys, shellKeys } from "@web/api/query-keys";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { afterEach, expect, it, vi } from "vitest";

import { issueContract } from "#support/issue";
import { mountWithQuery } from "#support/mount";
import { testQueryClient } from "#support/query";
import { memoryStorage } from "#support/storage";

const keys = hostKeys("local");

const HOUR_MS = 3_600_000;

function seeded(issues: IssueContract[], updatedAt: number): QueryClient {
  const source = testQueryClient();
  source.setQueryData(keys.issuesList("p1"), issues, { updatedAt });
  return source;
}

function listedIssues(cache: QueryClient): IssueContract[] | undefined {
  return cache.getQueryData(keys.issuesList("p1"));
}

function Probe() {
  const query = useQuery<IssueContract[]>({
    queryKey: keys.issuesList("p1"),
    queryFn: () => Promise.reject(new Error("daemon unreachable")),
  });
  return (
    <QueryBoundary query={query} pending={<span>loading</span>} error={<span>failed</span>}>
      {(issues) => <span>{issues.map((issue) => issue.id).join(",")}</span>}
    </QueryBoundary>
  );
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

it("restores the lists a visited project was last showing, still marked as of their fetch", () => {
  const storage = memoryStorage();
  const fetchedAt = Date.now() - 5 * 60_000;
  saveQuerySnapshot(seeded([issueContract({ id: "i1" })], fetchedAt), storage);

  const restored = testQueryClient();
  restoreQuerySnapshot(restored, storage);

  expect(listedIssues(restored)?.map((issue) => issue.id)).toEqual(["i1"]);
  expect(restored.getQueryState(keys.issuesList("p1"))?.dataUpdatedAt).toBe(fetchedAt);
});

it("revalidates a restored list even when it is younger than the stale time", () => {
  const storage = memoryStorage();
  saveQuerySnapshot(seeded([issueContract({ id: "i1" })], Date.now()), storage);

  const restored = testQueryClient();
  restoreQuerySnapshot(restored, storage);

  expect(restored.getQueryState(keys.issuesList("p1"))?.isInvalidated).toBe(true);
});

it("leaves a cold cache empty when the project was never visited", () => {
  const restored = testQueryClient();

  restoreQuerySnapshot(restored, memoryStorage());

  expect(listedIssues(restored)).toBeUndefined();
});

it("keeps the restored rows behind the stale notice when the refresh fails", async () => {
  const storage = memoryStorage();
  saveQuerySnapshot(seeded([issueContract({ id: "i1" })], Date.now() - 5 * 60_000), storage);
  const restored = testQueryClient();
  restoreQuerySnapshot(restored, storage);

  const mounted = await mountWithQuery(<Probe />, restored);
  cleanups.push(mounted.cleanup);

  expect(mounted.container.textContent).toContain("i1");
  expect(mounted.container.textContent).toContain("Couldn’t refresh");
  expect(mounted.container.textContent).not.toContain("failed");
});

it("keeps every host's lists apart inside the one snapshot", () => {
  const storage = memoryStorage();
  const source = seeded([issueContract({ id: "i1" })], Date.now());
  source.setQueryData(hostKeys("remote").issuesList("p1"), [issueContract({ id: "i2" })]);
  saveQuerySnapshot(source, storage);

  const restored = testQueryClient();
  restoreQuerySnapshot(restored, storage);

  expect(listedIssues(restored)?.map((issue) => issue.id)).toEqual(["i1"]);
  expect(
    restored
      .getQueryData<IssueContract[]>(hostKeys("remote").issuesList("p1"))
      ?.map((issue) => issue.id),
  ).toEqual(["i2"]);
});

it("stores what a tab reopens on, but never a diff or the live host status", () => {
  const storage = memoryStorage();
  const source = seeded([issueContract({ id: "i1" })], Date.now());
  const diffKey = keys.reviewDiff({ kind: "run", id: "run-1" });
  source.setQueryData(diffKey, { files: [] });
  source.setQueryData(keys.issue("i1"), issueContract({ id: "i1" }));
  source.setQueryData(shellKeys.executionHost, { active_id: "local" });

  saveQuerySnapshot(source, storage);
  const restored = testQueryClient();
  restoreQuerySnapshot(restored, storage);

  expect(listedIssues(restored)).toBeDefined();
  expect(restored.getQueryData(keys.issue("i1"))).toBeDefined();
  expect(restored.getQueryData(diffKey)).toBeUndefined();
  expect(restored.getQueryData(shellKeys.executionHost)).toBeUndefined();
});

it("drops a snapshot older than a day rather than reopening a stale cockpit", () => {
  const storage = memoryStorage();
  saveQuerySnapshot(seeded([issueContract({ id: "i1" })], Date.now()), storage);

  vi.useFakeTimers({ now: Date.now() + 25 * HOUR_MS });
  const restored = testQueryClient();
  restoreQuerySnapshot(restored, storage);

  expect(listedIssues(restored)).toBeUndefined();
});

it("keeps writing while the window lives, so a crash loses at most one interval", () => {
  vi.useFakeTimers();
  const attached = testQueryClient();
  attachQuerySnapshot(attached);

  attached.setQueryData(keys.issuesList("p1"), [issueContract({ id: "i1" })]);
  vi.advanceTimersByTime(30_000);

  const reopened = testQueryClient();
  restoreQuerySnapshot(reopened);
  expect(listedIssues(reopened)?.map((issue) => issue.id)).toEqual(["i1"]);
});

it("restores on attach and writes the snapshot back when the document goes away", () => {
  saveQuerySnapshot(seeded([issueContract({ id: "i1" })], Date.now() - 60_000));

  const attached = testQueryClient();
  attachQuerySnapshot(attached);
  expect(listedIssues(attached)?.map((issue) => issue.id)).toEqual(["i1"]);

  attached.setQueryData(keys.issuesList("p1"), [issueContract({ id: "i2" })]);
  window.dispatchEvent(new Event("pagehide"));

  const reopened = testQueryClient();
  restoreQuerySnapshot(reopened);
  expect(listedIssues(reopened)?.map((issue) => issue.id)).toEqual(["i2"]);
});
