// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { LinearIssueSnapshot } from "@otomat/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  linearWriteConflict,
  usePublishLinearFields,
  usePublishLinearStatus,
} from "@web/api/linear/writeback";
import { queryKeys } from "@web/api/query-keys";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const publishLinearFields = vi.fn();
const publishLinearStatus = vi.fn();
const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@web/api/client", () => ({
  daemon: {
    publishLinearFields: (id: string, request: unknown) => publishLinearFields(id, request),
    publishLinearStatus: (id: string, request: unknown) => publishLinearStatus(id, request),
  },
}));

vi.mock("@otomat/ui", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

const REMOTE: LinearIssueSnapshot = {
  title: "Changed remotely",
  description: "Body",
  priority: 2,
  assignee_id: "u1",
  label_ids: ["lab1"],
  external_id: "L-1",
  identifier: "OTO-99",
  url: "https://linear.app/otomat/issue/OTO-99",
  updated_at: "2026-07-21T09:00:00.000Z",
  assignee: { id: "u1", name: "Alim" },
  labels: [{ id: "lab1", name: "Bug", color: "#f00" }],
  state: { id: "s-todo", name: "Todo", type: "unstarted", color: "#888" },
};

function conflictError(): DaemonRequestError {
  return new DaemonRequestError(409, "/api/linear/issues/li/publish-fields", {
    error: "linear_write_conflict",
    message: "The Linear issue changed since you started editing.",
    remote: REMOTE,
  });
}

function FieldsProbe() {
  const publish = usePublishLinearFields("li");
  return (
    <button type="button" onClick={() => publish.mutate({ overwrite: false })}>
      Publish fields
    </button>
  );
}

function StatusProbe() {
  const publish = usePublishLinearStatus("li");
  return (
    <button type="button" onClick={() => publish.mutate({ state_id: "s-done", run_id: null })}>
      Publish status
    </button>
  );
}

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  publishLinearFields.mockReset();
  publishLinearStatus.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  document.body.replaceChildren();
});

it("parses the remote snapshot from a write-conflict response", () => {
  expect(linearWriteConflict(conflictError())?.remote.title).toBe("Changed remotely");
  expect(linearWriteConflict(new DaemonRequestError(500, "/x", { error: "boom" }))).toBeNull();
  expect(linearWriteConflict(new Error("nope"))).toBeNull();
});

it("does not toast a fields conflict but still refreshes the writeback state", async () => {
  publishLinearFields.mockRejectedValue(conflictError());
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  rendered = await mount(
    <QueryClientProvider client={client}>
      <FieldsProbe />
    </QueryClientProvider>,
  );

  rendered.container.querySelector("button")?.click();

  await vi.waitFor(() => {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.linearWriteback("li") });
  });
  expect(toastError).not.toHaveBeenCalled();
});

it("confirms a published status and refreshes the mirror", async () => {
  publishLinearStatus.mockResolvedValue({ draft: null, writes: [] });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  rendered = await mount(
    <QueryClientProvider client={client}>
      <StatusProbe />
    </QueryClientProvider>,
  );

  rendered.container.querySelector("button")?.click();

  await vi.waitFor(() => {
    expect(toastSuccess).toHaveBeenCalledWith("Published status to Linear");
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.issue("li") });
  });
});
