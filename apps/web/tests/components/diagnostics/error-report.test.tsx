// @vitest-environment happy-dom
import { DaemonRequestError, DaemonTransportError } from "@otomat/client";
import type { DaemonLogExcerpt } from "@otomat/domain";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { act, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

const EMPTY_EXCERPT: DaemonLogExcerpt = {
  correlation_id: "req_abc123",
  truncated: false,
  entries: [],
};

let excerpt: DaemonLogExcerpt | Error = EMPTY_EXCERPT;

vi.mock("@web/api/daemon/queries", () => ({
  useHealth: () => ({ data: { version: "0.1.0", build: "abc1234" } }),
}));

vi.mock("@web/api/client", () => ({
  daemon: {
    daemonLogExcerpt: async () => {
      if (excerpt instanceof Error) throw excerpt;
      return excerpt;
    },
  },
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  excerpt = EMPTY_EXCERPT;
  delete window.otomat;
});

async function render(node: ReactNode) {
  const mounted = await mountWithQuery(node);
  cleanups.push(mounted.cleanup);
}

async function click(label: string) {
  const button = findButton(label);
  expect(button, label).toBeDefined();
  await act(async () => {
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function daemonFailure() {
  return new DaemonRequestError(500, "POST", "/api/runs", null, "req_abc123");
}

it("says a panel-layout fault is a renderer error and never points at daemon logs", async () => {
  const failure = new Error("Panel constraints not found for Panel issue-rail");

  await render(<ErrorReport error={failure} onRetry={() => {}} />);

  const text = document.body.textContent ?? "";
  expect(text).toContain("The cockpit hit a renderer error");
  expect(text).toContain("No daemon log holds it");
  expect(text).not.toContain("Host log excerpt");
  expect(text).toMatch(/err_[0-9a-z]+/);
});

it("names the active host and status, and shows that host's own excerpt", async () => {
  window.otomat = fakeDesktopBridge({
    executionHostId: "remote",
    executionHostSshAlias: "otomat-vps",
  });
  excerpt = {
    correlation_id: "req_abc123",
    truncated: false,
    entries: [
      {
        at: "2026-08-07T09:15:00.000Z",
        correlation_id: "req_abc123",
        message: "POST /api/runs responded 500",
      },
    ],
  };

  await render(<ErrorReport error={daemonFailure()} onRetry={() => {}} />);

  const text = document.body.textContent ?? "";
  expect(text).toContain("Remote · otomat-vps could not complete this request");
  expect(text).toContain("answered 500");
  expect(text).toContain("Host log excerpt");
  expect(text).toContain("POST /api/runs responded 500");
});

it("says the host kept no line rather than leaving the excerpt silent", async () => {
  await render(<ErrorReport error={daemonFailure()} onRetry={() => {}} />);

  expect(document.body.textContent).toContain("kept no log line for this request");
});

it("says the host could not be asked when the excerpt request itself fails", async () => {
  excerpt = new Error("tunnel closed");

  await render(<ErrorReport error={daemonFailure()} onRetry={() => {}} />);

  expect(document.body.textContent).toContain("could not be asked: tunnel closed");
});

it("says a transport failure never reached the host, and asks no host for logs", async () => {
  const failure = new DaemonTransportError("GET", "/api/health", new Error("ECONNREFUSED"));

  await render(<ErrorReport error={failure} onRetry={() => {}} />);

  const text = document.body.textContent ?? "";
  expect(text).toContain("could not reach");
  expect(text).toContain("The request never arrived");
  expect(text).not.toContain("Host log excerpt");
});

it("offers a way back: retry, and go back when the caller can navigate", async () => {
  const retry = vi.fn();
  const back = vi.fn();

  await render(<ErrorReport error={new Error("boom")} onRetry={retry} onBack={back} />);
  await click("Retry");
  await click("Go back");

  expect(retry).toHaveBeenCalledTimes(1);
  expect(back).toHaveBeenCalledTimes(1);
});

it("hides the back action when there is nowhere to go back to", async () => {
  await render(
    <ErrorReport error={new Error("boom")} retryLabel="Reload Otomat" onRetry={vi.fn()} />,
  );

  expect(findButton("Go back")).toBeUndefined();
  expect(findButton("Reload Otomat")).toBeDefined();
});

it("exports the incident through the shell, and only when asked", async () => {
  const bridge = fakeDesktopBridge();
  const exportBundle = vi.fn(() =>
    Promise.resolve({ status: "written" as const, path: "/tmp/b.json" }),
  );
  bridge.support.exportBundle = exportBundle;
  window.otomat = bridge;

  await render(<ErrorReport error={new Error("boom")} onRetry={() => {}} />);
  expect(exportBundle).not.toHaveBeenCalled();

  await click("Export support bundle");

  expect(exportBundle).toHaveBeenCalledTimes(1);
  expect(exportBundle.mock.calls[0]?.[0]).toMatchObject({ category: "renderer", message: "boom" });
});

it("opens a report draft only after the user confirms the previewed text", async () => {
  const bridge = fakeDesktopBridge();
  const openReportDraft = vi.fn(() => Promise.resolve());
  bridge.support.openReportDraft = openReportDraft;
  window.otomat = bridge;

  await render(<ErrorReport error={new Error("boom")} onRetry={() => {}} />);
  await click("Report problem");

  expect(document.body.textContent).toContain("Nothing has been sent");
  expect(openReportDraft).not.toHaveBeenCalled();

  await click("Open draft");

  expect(openReportDraft).toHaveBeenCalledTimes(1);
  expect(openReportDraft.mock.calls[0]?.[0]).toMatchObject({ title: "Renderer error: boom" });
});
