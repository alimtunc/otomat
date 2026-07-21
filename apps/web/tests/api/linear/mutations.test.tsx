// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateIssueSource, useSyncLinear } from "@web/api/linear/mutations";
import { queryKeys } from "@web/api/query-keys";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const syncLinear = vi.fn();
const createIssueSource = vi.fn();
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("@web/api/client", () => ({
  daemon: {
    createIssueSource: (request: unknown) => createIssueSource(request),
    syncLinear: (request: unknown) => syncLinear(request),
  },
}));

vi.mock("@otomat/ui", () => ({
  toast: { error: toastError, success: vi.fn() },
}));

function SyncProbe() {
  const sync = useSyncLinear();
  return (
    <button type="button" onClick={() => sync.mutate({})}>
      Sync
    </button>
  );
}

function CreateSourceProbe() {
  const createSource = useCreateIssueSource();
  return (
    <button
      type="button"
      onClick={() => createSource.mutate({ project_id: "p1", external_team_id: "linear-team-1" })}
    >
      Create source
    </button>
  );
}

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  syncLinear.mockReset();
  createIssueSource.mockReset();
  toastError.mockReset();
  document.body.replaceChildren();
});

it("refreshes persisted rows when a multi-source sync rejects after partial progress", async () => {
  syncLinear.mockRejectedValue(new Error("second source failed"));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  rendered = await mount(
    <QueryClientProvider client={client}>
      <SyncProbe />
    </QueryClientProvider>,
  );

  rendered.container.querySelector("button")?.click();

  await vi.waitFor(() => {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.issues });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.issueSources });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.linearConnection });
  });
  expect(toastError).toHaveBeenCalledWith("second source failed");
});

it("silences a sync canceled by a newer connection state", async () => {
  syncLinear.mockRejectedValue(
    new DaemonRequestError(409, "/api/linear/sync", {
      error: "linear_request_superseded",
      message: "A newer Linear connection state replaced this request.",
    }),
  );
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  rendered = await mount(
    <QueryClientProvider client={client}>
      <SyncProbe />
    </QueryClientProvider>,
  );

  rendered.container.querySelector("button")?.click();

  await vi.waitFor(() => {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.linearConnection });
  });
  expect(toastError).not.toHaveBeenCalled();
});

it("refreshes the whole Linear state when source validation changes authorization", async () => {
  createIssueSource.mockRejectedValue(
    new DaemonRequestError(409, "/api/linear/sources", {
      error: "linear_request_superseded",
      message: "A newer Linear connection state replaced this request.",
    }),
  );
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  rendered = await mount(
    <QueryClientProvider client={client}>
      <CreateSourceProbe />
    </QueryClientProvider>,
  );

  rendered.container.querySelector("button")?.click();

  await vi.waitFor(() => {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.linear });
  });
});
