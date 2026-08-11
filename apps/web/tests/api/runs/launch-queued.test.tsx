// @vitest-environment happy-dom
import type { RunContract, RunLaunchResponse } from "@otomat/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const { startRun, toastError, toastInfo, toastSuccess } = vi.hoisted(() => ({
  startRun: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  toast: { success: toastSuccess, error: toastError, info: toastInfo },
}));

vi.mock("@web/api/client", () => ({ daemon: { startRun: (r: unknown) => startRun(r) } }));

const RUN: RunContract = {
  id: "run-1",
  issue_id: "i-1",
  status: "queued",
  branch: "otomat/run/abc12345",
  plan_json: { version: 1, steps: [] },
  updated_at: "2026-08-10T00:00:00.000Z",
};

let rendered: Mounted | null = null;
let launched: RunContract | null | undefined;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  document.body.replaceChildren();
  startRun.mockReset();
  toastError.mockReset();
  toastInfo.mockReset();
  toastSuccess.mockReset();
  launched = undefined;
});

function Harness() {
  const { launch } = useLaunchRun();
  return (
    <button
      type="button"
      onClick={() => {
        void launch({ prompt: "go" }).then((run) => {
          launched = run;
        });
      }}
    >
      go
    </button>
  );
}

async function launchOnce(response: RunLaunchResponse) {
  startRun.mockResolvedValue(response);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  rendered = await mount(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  rendered.container.querySelector("button")?.click();
}

it("says a saturated launch is queued, with the place and the host's limit", async () => {
  await launchOnce({
    run: RUN,
    wait: {
      kind: "concurrency_limit",
      position: 2,
      active_sessions: 4,
      max_concurrent_sessions: 4,
    },
  });

  await vi.waitFor(() => {
    expect(toastInfo).toHaveBeenCalledWith("Run queued", {
      description: "#2 in line — 4 of 4 agent sessions active on this host.",
    });
  });
  expect(toastSuccess).not.toHaveBeenCalled();
  expect(launched).toMatchObject({ id: "run-1", status: "queued" });
});

it("only says a run started once its first step took a slot", async () => {
  await launchOnce({ run: { ...RUN, status: "running" }, wait: null });

  await vi.waitFor(() => {
    expect(toastSuccess).toHaveBeenCalledWith("Run started");
  });
  expect(toastInfo).not.toHaveBeenCalled();
});
