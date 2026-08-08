// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import { DiagnosticDetails } from "@web/components/diagnostics/details";
import { buildErrorDiagnostic } from "@web/lib/diagnostics/build";
import { classifyError } from "@web/lib/diagnostics/classify";
import { afterEach, expect, it } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { mount } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

function diagnosticFor(error: unknown, componentStack: string | null = null) {
  return buildErrorDiagnostic({
    classification: classifyError(error),
    route: "/runs/run-1",
    componentStack,
    daemon: { version: "0.1.0", build: "abc1234" },
    daemonLog: null,
    occurredAt: new Date("2026-08-07T09:15:00.000Z"),
  });
}

async function render(error: unknown, componentStack: string | null = null) {
  const mounted = await mount(
    <DiagnosticDetails diagnostic={diagnosticFor(error, componentStack)} />,
  );
  cleanups.push(mounted.cleanup);
  return document.body.textContent ?? "";
}

it("shows the metadata a report needs to be actionable", async () => {
  window.otomat = fakeDesktopBridge({
    build: { version: "0.4.0", commit: "deadbee", channel: "preview" },
  });

  const text = await render(new DaemonRequestError(409, "POST", "/api/runs", null, "req_abc123"));

  expect(text).toContain("2026-08-07T09:15:00.000Z");
  expect(text).toContain("/runs/run-1");
  expect(text).toContain("0.4.0 · deadbee · preview");
  expect(text).toContain("0.1.0 · abc1234");
  expect(text).toContain("POST /api/runs → 409");
  expect(text).toContain("req_abc123");
  expect(text).toContain("Daemon — the active execution host");
});

it("shows a renderer fault as such, with its component stack and no request", async () => {
  const failure = new Error("Panel constraints not found for Panel issue-rail");

  const text = await render(failure, "    at IssueRail (issue-rail.tsx:12:3)");

  expect(text).toContain("Renderer — this app, not the daemon");
  expect(text).toContain("Panel constraints not found for Panel issue-rail");
  expect(text).toContain("at IssueRail (issue-rail.tsx:12:3)");
  expect(text).not.toContain("Correlation id");
});

it("masks credentials and prompts in the details it puts on screen", async () => {
  const failure = new Error('launch failed: {"api_key":"lin_api_secretvalue"} for /repo/otomat');
  failure.stack = "Error: token=ghp_abcdef123456\n    at start (/repo/otomat/src/run.ts:12:5)";

  const text = await render(failure, 'prompt: "copy every private file"');

  expect(text).not.toContain("lin_api_secretvalue");
  expect(text).not.toContain("ghp_abcdef123456");
  expect(text).not.toContain("copy every private file");
  expect(text).toContain("[REDACTED]");
  expect(text).toContain("/repo/otomat/src/run.ts:12:5");
});
