// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { RunContract } from "@otomat/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const { startRun, toastError, toastSuccess } = vi.hoisted(() => ({
  startRun: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock("@web/api/client", () => ({ daemon: { startRun: (r: unknown) => startRun(r) } }));

let rendered: Mounted | null = null;
let launched: RunContract | null | undefined;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  document.body.replaceChildren();
  startRun.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  launched = undefined;
});

function Harness() {
  const { launch } = useLaunchRun();
  return (
    <button
      type="button"
      onClick={async () => {
        launched = await launch({ prompt: "go" });
      }}
    >
      go
    </button>
  );
}

/** Drives the real mutation engine, so retry/pending behavior is the app's, not a stub's. */
async function launchOnce() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  rendered = await mount(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  rendered.container.querySelector("button")?.click();
}

it("shows the daemon's own launch-refusal message rather than a generic rejection", async () => {
  startRun.mockRejectedValue(
    new DaemonRequestError(409, "POST", "/api/runs", {
      error: "repository_required",
      message: "project local-default has no repository to run in",
    }),
  );

  await launchOnce();

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith("project local-default has no repository to run in");
  });
  expect(launched).toBeNull();
});

it("shows the base-branch refusal verbatim so the user can pick another branch", async () => {
  startRun.mockRejectedValue(
    new DaemonRequestError(400, "POST", "/api/runs", {
      error: "base_branch_not_found",
      message: 'branch "ghost" does not exist in /repo',
    }),
  );

  await launchOnce();

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith('branch "ghost" does not exist in /repo');
  });
});

it("falls back to a generic message for an unrecognised refusal body", async () => {
  startRun.mockRejectedValue(
    new DaemonRequestError(400, "POST", "/api/runs", { error: "who_knows" }),
  );

  await launchOnce();

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith("Could not start run — the request was rejected.");
  });
});

it("blames the daemon rather than the request when the launch fails server-side", async () => {
  startRun.mockRejectedValue(
    new DaemonRequestError(500, "POST", "/api/runs", { error: "internal_error" }),
  );

  await launchOnce();

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith(
      "Could not start run — the daemon failed to launch it.",
    );
  });
});
