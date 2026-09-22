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
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { issueContract } from "#support/issue";
import { mountWithQuery } from "#support/mount";
import { testQueryClient } from "#support/query";
import { memorySnapshotStore } from "#support/storage";

const keys = hostKeys("local");

const HOUR_MS = 3_600_000;

function seeded(issues: IssueContract[], updatedAt: number): QueryClient {
  const source = testQueryClient();
  source.setQueryData(keys.issueCatalog("p1"), issues, { updatedAt });
  return source;
}

function listedIssues(cache: QueryClient): IssueContract[] | undefined {
  return cache.getQueryData(keys.issueCatalog("p1"));
}

function Probe() {
  const query = useQuery<IssueContract[]>({
    queryKey: keys.issueCatalog("p1"),
    queryFn: () => Promise.reject(new Error("daemon unreachable")),
  });
  return (
    <QueryBoundary query={query} pending={<span>loading</span>} error={<span>failed</span>}>
      {(issues) => <span>{issues.map((issue) => issue.id).join(",")}</span>}
    </QueryBoundary>
  );
}

const cleanups: Array<() => Promise<void>> = [];
const reportError = vi.fn();

beforeEach(() => {
  reportError.mockClear();
  // happy-dom has no reportError; Chromium, where the cockpit runs, does.
  vi.stubGlobal("reportError", reportError);
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

it("restores the lists a visited project was last showing, still marked as of their fetch", async () => {
  const store = memorySnapshotStore();
  const fetchedAt = Date.now() - 5 * 60_000;
  await saveQuerySnapshot(seeded([issueContract({ id: "i1" })], fetchedAt), store);

  const restored = testQueryClient();
  await restoreQuerySnapshot(restored, store);

  expect(listedIssues(restored)?.map((issue) => issue.id)).toEqual(["i1"]);
  expect(restored.getQueryState(keys.issueCatalog("p1"))?.dataUpdatedAt).toBe(fetchedAt);
});

it("revalidates a restored list even when it is younger than the stale time", async () => {
  const store = memorySnapshotStore();
  await saveQuerySnapshot(seeded([issueContract({ id: "i1" })], Date.now()), store);

  const restored = testQueryClient();
  await restoreQuerySnapshot(restored, store);

  expect(restored.getQueryState(keys.issueCatalog("p1"))?.isInvalidated).toBe(true);
});

it("leaves a cold cache empty when the project was never visited", async () => {
  const restored = testQueryClient();

  await restoreQuerySnapshot(restored, memorySnapshotStore());

  expect(listedIssues(restored)).toBeUndefined();
});

it("keeps the restored rows behind the stale notice when the refresh fails", async () => {
  const store = memorySnapshotStore();
  await saveQuerySnapshot(seeded([issueContract({ id: "i1" })], Date.now() - 5 * 60_000), store);
  const restored = testQueryClient();
  await restoreQuerySnapshot(restored, store);

  const mounted = await mountWithQuery(<Probe />, restored);
  cleanups.push(mounted.cleanup);

  expect(mounted.container.textContent).toContain("i1");
  expect(mounted.container.textContent).toContain("Couldn’t refresh");
  expect(mounted.container.textContent).not.toContain("failed");
});

it("keeps every host's lists apart inside the one snapshot", async () => {
  const store = memorySnapshotStore();
  const source = seeded([issueContract({ id: "i1" })], Date.now());
  source.setQueryData(hostKeys("remote").issueCatalog("p1"), [issueContract({ id: "i2" })]);
  await saveQuerySnapshot(source, store);

  const restored = testQueryClient();
  await restoreQuerySnapshot(restored, store);

  expect(listedIssues(restored)?.map((issue) => issue.id)).toEqual(["i1"]);
  expect(
    restored
      .getQueryData<IssueContract[]>(hostKeys("remote").issueCatalog("p1"))
      ?.map((issue) => issue.id),
  ).toEqual(["i2"]);
});

it("stores what a tab reopens on, but never a diff, a git-backed run read or the live host status", async () => {
  const store = memorySnapshotStore();
  const source = seeded([issueContract({ id: "i1" })], Date.now());
  const diffKey = keys.reviewDiff({ kind: "run", id: "run-1" });
  source.setQueryData(diffKey, { files: [] });
  source.setQueryData(keys.issue("i1"), issueContract({ id: "i1" }));
  source.setQueryData(keys.run("run-1"), { run: { id: "run-1" } });
  source.setQueryData(keys.runsForIssue("i1"), []);
  source.setQueryData(keys.runCompletionReport("run-1"), { report: {} });
  source.setQueryData(keys.pullRequestOverview("pr-1"), { number: 1 });
  source.setQueryData(keys.linearComments("i1"), []);
  source.setQueryData(keys.linearMedia("i1", "https://example.test/a.png"), "data:");
  source.setQueryData(keys.conversations, { entries: [] });
  source.setQueryData(shellKeys.executionHost, { active_id: "local" });

  await saveQuerySnapshot(source, store);
  const restored = testQueryClient();
  await restoreQuerySnapshot(restored, store);

  expect(listedIssues(restored)).toBeDefined();
  expect(restored.getQueryData(keys.issue("i1"))).toBeDefined();
  expect(restored.getQueryData(keys.run("run-1"))).toBeDefined();
  expect(restored.getQueryData(keys.runsForIssue("i1"))).toBeDefined();
  expect(restored.getQueryData(keys.pullRequestOverview("pr-1"))).toBeDefined();
  expect(restored.getQueryData(keys.linearComments("i1"))).toBeDefined();
  expect(restored.getQueryData(keys.conversations)).toBeDefined();
  expect(restored.getQueryData(diffKey)).toBeUndefined();
  expect(restored.getQueryData(keys.runCompletionReport("run-1"))).toBeUndefined();
  expect(
    restored.getQueryData(keys.linearMedia("i1", "https://example.test/a.png")),
  ).toBeUndefined();
  expect(restored.getQueryData(shellKeys.executionHost)).toBeUndefined();
});

it("drops a snapshot older than a day rather than reopening a stale cockpit", async () => {
  const store = memorySnapshotStore();
  await saveQuerySnapshot(seeded([issueContract({ id: "i1" })], Date.now()), store);

  vi.useFakeTimers({ now: Date.now() + 25 * HOUR_MS });
  const restored = testQueryClient();
  await restoreQuerySnapshot(restored, store);

  expect(listedIssues(restored)).toBeUndefined();
});

it("keeps writing while the window lives, so a crash loses at most one interval", async () => {
  vi.useFakeTimers();
  const store = memorySnapshotStore();
  const attached = testQueryClient();
  await attachQuerySnapshot(attached, store);

  attached.setQueryData(keys.issueCatalog("p1"), [issueContract({ id: "i1" })]);
  await vi.advanceTimersByTimeAsync(30_000);

  const reopened = testQueryClient();
  await restoreQuerySnapshot(reopened, store);
  expect(listedIssues(reopened)?.map((issue) => issue.id)).toEqual(["i1"]);
});

it("restores on attach and writes the snapshot back when the document goes away", async () => {
  const store = memorySnapshotStore();
  await saveQuerySnapshot(seeded([issueContract({ id: "i1" })], Date.now() - 60_000), store);

  const attached = testQueryClient();
  await attachQuerySnapshot(attached, store);
  expect(listedIssues(attached)?.map((issue) => issue.id)).toEqual(["i1"]);

  attached.setQueryData(keys.issueCatalog("p1"), [issueContract({ id: "i2" })]);
  window.dispatchEvent(new Event("pagehide"));
  await vi.waitFor(async () => {
    const reopened = testQueryClient();
    await restoreQuerySnapshot(reopened, store);
    expect(listedIssues(reopened)?.map((issue) => issue.id)).toEqual(["i2"]);
  });
});

it("saves as soon as the window is hidden, before an unload could drop the write", async () => {
  const store = memorySnapshotStore();
  const attached = testQueryClient();
  await attachQuerySnapshot(attached, store);
  attached.setQueryData(keys.issueCatalog("p1"), [issueContract({ id: "i3" })]);

  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  visibility.mockRestore();

  await vi.waitFor(() => expect(store.value).toContain("i3"));
});

it("starts from the daemon and keeps saving when the stored snapshot cannot be read", async () => {
  const store = memorySnapshotStore();
  store.value = "{not json";
  const attached = testQueryClient();

  await attachQuerySnapshot(attached, store);
  attached.setQueryData(keys.issueCatalog("p1"), [issueContract({ id: "i1" })]);
  window.dispatchEvent(new Event("pagehide"));

  expect(reportError).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(store.value).toContain("i1"));
});

it("drops the snapshot localStorage used to hold", async () => {
  window.localStorage.setItem("otomat.query-snapshot", "{}");
  await attachQuerySnapshot(testQueryClient(), memorySnapshotStore());
  expect(window.localStorage.getItem("otomat.query-snapshot")).toBeNull();
});

it("keeps legacy full lists and searches out of the stored catalog", async () => {
  const source = seeded([issueContract()], Date.now());
  source.setQueryData(keys.issuesList("p1"), [issueContract({ body: "large body" })]);
  source.setQueryData(keys.issueSearch("p1", "large"), { issues: [], total: 0 });
  source.setQueryData(keys.runsList("p1"), [{ plan_json: { steps: [] } }]);
  const store = memorySnapshotStore();
  await saveQuerySnapshot(source, store);
  const restored = testQueryClient();
  await restoreQuerySnapshot(restored, store);
  expect(listedIssues(restored)).toBeDefined();
  expect(restored.getQueryData(keys.issuesList("p1"))).toBeUndefined();
  expect(restored.getQueryData(keys.issueSearch("p1", "large"))).toBeUndefined();
  expect(restored.getQueryData(keys.runsList("p1"))).toBeUndefined();
});

it("bounds persisted data by dropping whole older queries while retaining the live cache", async () => {
  const source = testQueryClient();
  source.setQueryData(keys.issueCatalog("old"), "a".repeat(12_000_000), { updatedAt: 1 });
  source.setQueryData(keys.issueCatalog("recent"), "b".repeat(12_000_000), { updatedAt: 2 });
  const store = memorySnapshotStore();
  await saveQuerySnapshot(source, store);
  expect(store.value!.length).toBeLessThan(24_000_100);
  const restored = testQueryClient();
  await restoreQuerySnapshot(restored, store);
  expect(restored.getQueryData(keys.issueCatalog("old"))).toBeUndefined();
  expect(restored.getQueryData(keys.issueCatalog("recent"))).toBeDefined();
  expect(source.getQueryData(keys.issueCatalog("old"))).toBeDefined();
});

it("does not serialize again for invalidations or page exits without new data", async () => {
  vi.useFakeTimers();
  const store = memorySnapshotStore();
  const write = vi.spyOn(store, "set");
  const client = testQueryClient();
  await attachQuerySnapshot(client, store);
  client.setQueryData(keys.issueCatalog("p1"), []);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(write).toHaveBeenCalledTimes(1);
  void client.invalidateQueries({ queryKey: keys.issues });
  await vi.advanceTimersByTimeAsync(30_000);
  window.dispatchEvent(new Event("pagehide"));
  expect(write).toHaveBeenCalledTimes(1);
  write.mockRestore();
});
