// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { LinearSyncStatusContract } from "@otomat/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLinearConnection } from "@web/api/linear/queries";
import { useProjectLinearSync } from "@web/api/linear/use-project-sync";
import { queryKeys } from "@web/api/query-keys";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const syncLinear = vi.fn();
const getLinearSyncStatus = vi.fn();
const getLinearConnection = vi.fn();
const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@web/api/client", () => ({
  daemon: {
    syncLinear: (request: unknown) => syncLinear(request),
    getLinearSyncStatus: (projectId: string) => getLinearSyncStatus(projectId),
    getLinearConnection: () => getLinearConnection(),
  },
}));

vi.mock("@otomat/ui", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

function status(overrides: Partial<LinearSyncStatusContract> = {}): LinearSyncStatusContract {
  return {
    project_id: "p1",
    sources: 1,
    running: false,
    last_synced_at: null,
    last_result: null,
    last_error: null,
    ...overrides,
  };
}

/** Two independent consumers of one project, as the shell and the Issues view are. */
function SyncProbe() {
  const one = useProjectLinearSync("p1");
  const two = useProjectLinearSync("p1");
  const connection = useLinearConnection();
  const ready = one.status !== null && connection.data !== undefined;
  return (
    <>
      <button type="button" onClick={() => one.refresh({ announce: true })}>
        Refresh
      </button>
      <button type="button" onClick={() => one.refresh({ full: true, announce: true })}>
        Full
      </button>
      <button
        type="button"
        onClick={() => {
          one.refreshIfStale();
          two.refreshIfStale();
        }}
      >
        Stale
      </button>
      <span data-testid="loaded">{ready ? "yes" : "no"}</span>
      <span data-testid="running">{String(one.running)}</span>
    </>
  );
}

function click(container: HTMLElement, label: string): void {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (button === undefined) throw new Error(`no button labelled ${label}`);
  button.click();
}

function text(container: HTMLElement, testId: string): string | undefined {
  return container.querySelector(`[data-testid='${testId}']`)?.textContent ?? undefined;
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let rendered: Mounted | null = null;
let client: QueryClient;

/** Mounts and waits for the owning daemon's answer: before it lands nothing may be assumed stale. */
async function renderProbe(): Promise<HTMLElement> {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const mounted = await mount(
    <QueryClientProvider client={client}>
      <SyncProbe />
    </QueryClientProvider>,
  );
  rendered = mounted;
  await vi.waitFor(() => expect(text(mounted.container, "loaded")).toBe("yes"));
  return mounted.container;
}

beforeEach(() => {
  syncLinear.mockResolvedValue({ results: [{ imported: 1, updated: 0 }] });
  getLinearSyncStatus.mockResolvedValue(status());
  getLinearConnection.mockResolvedValue({ status: "connected", workspace_id: "workspace-1" });
});

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  syncLinear.mockReset();
  getLinearSyncStatus.mockReset();
  getLinearConnection.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  document.body.replaceChildren();
});

it("scopes an explicit refresh to the active project and reports what landed", async () => {
  const container = await renderProbe();

  click(container, "Refresh");

  await vi.waitFor(() => expect(syncLinear).toHaveBeenCalledTimes(1));
  expect(syncLinear).toHaveBeenCalledWith({ project_id: "p1", full: false });
  await vi.waitFor(() =>
    expect(toastSuccess).toHaveBeenCalledWith("Synced Linear — 1 imported, 0 updated."),
  );
});

it("says nothing changed instead of implying an import happened", async () => {
  syncLinear.mockResolvedValue({ results: [{ imported: 0, updated: 0 }] });
  const container = await renderProbe();

  click(container, "Refresh");

  await vi.waitFor(() =>
    expect(toastSuccess).toHaveBeenCalledWith("Issues are already up to date."),
  );
});

it("asks for a full reconciliation only when one is requested", async () => {
  const container = await renderProbe();

  click(container, "Full");

  await vi.waitFor(() => expect(syncLinear).toHaveBeenCalledWith({ project_id: "p1", full: true }));
});

it("collapses triggers that fire in the same commit into one request", async () => {
  const container = await renderProbe();

  click(container, "Stale");
  await flush();

  expect(syncLinear).toHaveBeenCalledTimes(1);
});

it("skips an automatic refresh while the last success is still fresh", async () => {
  getLinearSyncStatus.mockResolvedValue(
    status({ last_synced_at: new Date(Date.now() - 5_000).toISOString() }),
  );
  const container = await renderProbe();

  click(container, "Stale");
  await flush();

  expect(syncLinear).not.toHaveBeenCalled();
});

it("refreshes automatically once the last success has aged out", async () => {
  getLinearSyncStatus.mockResolvedValue(
    status({ last_synced_at: new Date(Date.now() - 120_000).toISOString() }),
  );
  const container = await renderProbe();

  click(container, "Stale");

  await vi.waitFor(() => expect(syncLinear).toHaveBeenCalledTimes(1));
});

it("never runs an automatic pass while Linear is disconnected", async () => {
  getLinearConnection.mockResolvedValue({ status: "disconnected" });
  const container = await renderProbe();

  click(container, "Stale");
  await flush();

  expect(syncLinear).not.toHaveBeenCalled();
});

it("never asks Linear for a project with no mapped source", async () => {
  getLinearSyncStatus.mockResolvedValue(status({ sources: 0 }));
  const container = await renderProbe();

  click(container, "Stale");
  await flush();

  expect(syncLinear).not.toHaveBeenCalled();
});

it("reports a pass another component started as running", async () => {
  getLinearSyncStatus.mockResolvedValue(status({ running: true }));
  const container = await renderProbe();

  expect(text(container, "running")).toBe("true");
});

it("refreshes persisted rows and shouts when a partially applied sync rejects", async () => {
  syncLinear.mockRejectedValue(new Error("second source failed"));
  const container = await renderProbe();
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");

  click(container, "Refresh");

  await vi.waitFor(() => {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.issues });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.issueSources });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.linearConnection });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.linearSyncStatus("p1"),
    });
  });
  expect(toastError).toHaveBeenCalledWith("second source failed");
  expect(toastSuccess).not.toHaveBeenCalled();
});

it("silences a sync canceled by a newer connection state", async () => {
  syncLinear.mockRejectedValue(
    new DaemonRequestError(409, "/api/linear/sync", {
      error: "linear_request_superseded",
      message: "A newer Linear connection state replaced this request.",
    }),
  );
  const container = await renderProbe();
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");

  click(container, "Refresh");

  await vi.waitFor(() => {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.linearConnection });
  });
  expect(toastError).not.toHaveBeenCalled();
});
