// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import { readCatalog } from "@web/api/catalog-read";
import { useIssueSearch, useProjectIssueSummaries } from "@web/api/issues/queries";
import { hostKeys } from "@web/api/query-keys";
import { useProjectRuns } from "@web/api/runs/queries";
import { activeHostStore } from "@web/lib/active-host";
import { afterEach, expect, it, vi } from "vitest";

import { issueContract } from "#support/issue";
import { mountWithQuery } from "#support/mount";
import { testQueryClient } from "#support/query";
import { runContract } from "#support/run";

const mocks = vi.hoisted(() => ({
  listIssueSummaries: vi.fn(),
  searchIssues: vi.fn(),
  listRunSummaries: vi.fn(),
  listIssues: vi.fn(),
  listRuns: vi.fn(),
}));
vi.mock("@web/api/client", () => ({ daemon: mocks }));
afterEach(() => {
  vi.resetAllMocks();
  activeHostStore.setState(() => null);
});

function Probe({ projectId = "p1", query = "needle" }: { projectId?: string; query?: string }) {
  const issues = useProjectIssueSummaries(projectId);
  const runs = useProjectRuns(projectId);
  const search = useIssueSearch(projectId, query);
  return (
    <span>
      {issues.status}:{runs.status}:{search.data?.total}
    </span>
  );
}

it("shares one legacy fetch between summaries and body searches on an older daemon", async () => {
  const missing = new DaemonRequestError(404, "GET", "/api/issues/catalog", { error: "not_found" });
  mocks.listIssueSummaries.mockRejectedValue(missing);
  mocks.listRunSummaries.mockRejectedValue(missing);
  mocks.searchIssues.mockRejectedValue(missing);
  mocks.listIssues.mockResolvedValue([issueContract({ body: "needle in the description" })]);
  mocks.listRuns.mockResolvedValue([runContract()]);
  const client = testQueryClient();
  const view = await mountWithQuery(<Probe />, client);
  try {
    await vi.waitFor(() => expect(view.container.textContent).toBe("success:success:1"));
    await view.rerender(<Probe query="description" />);
    await vi.waitFor(() => expect(view.container.textContent).toBe("success:success:1"));
    expect(mocks.listIssues).toHaveBeenCalledTimes(1);
    expect(mocks.listRuns).toHaveBeenCalledTimes(1);
    const keys = hostKeys("local");
    expect(client.getQueryData(keys.issueCatalog("p1"))).toEqual([
      expect.not.objectContaining({ body: expect.anything() }),
    ]);
    expect(client.getQueryData(keys.runCatalog("p1"))).toEqual([
      expect.not.objectContaining({ plan_json: expect.anything() }),
    ]);
    await view.rerender(<Probe projectId="p2" />);
    await vi.waitFor(() => expect(mocks.listIssues).toHaveBeenCalledWith({ projectId: "p2" }));
  } finally {
    await view.cleanup();
  }
});

it("exposes server failures without retrying the expensive legacy endpoints", async () => {
  const failed = new DaemonRequestError(500, "GET", "/api/issues/catalog", { error: "failed" });
  mocks.listIssueSummaries.mockRejectedValue(failed);
  mocks.listRunSummaries.mockRejectedValue(failed);
  mocks.searchIssues.mockRejectedValue(failed);
  const view = await mountWithQuery(<Probe />);
  try {
    await vi.waitFor(() => expect(view.container.textContent).toBe("error:error:"));
    expect(mocks.listIssues).not.toHaveBeenCalled();
    expect(mocks.listRuns).not.toHaveBeenCalled();
  } finally {
    await view.cleanup();
  }
});

it("never sends a legacy fallback to a host selected while the catalog was loading", async () => {
  const request = Promise.withResolvers<never>();
  const legacy = vi.fn();
  const result = readCatalog(() => request.promise, legacy);
  activeHostStore.actions.activate({ id: "remote", daemonUrl: "http://127.0.0.1:45010" });
  const missing = new DaemonRequestError(404, "GET", "/api/issues/catalog", { error: "not_found" });
  request.reject(missing);
  await expect(result).rejects.toBe(missing);
  expect(legacy).not.toHaveBeenCalled();
});
