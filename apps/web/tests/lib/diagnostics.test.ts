// @vitest-environment happy-dom
import { DaemonRequestError, DaemonTransportError } from "@otomat/client";
import { buildErrorDiagnostic } from "@web/lib/diagnostics/build";
import { classifyError } from "@web/lib/diagnostics/classify";
import {
  componentStackFor,
  componentStacksVersion,
  recordComponentStack,
} from "@web/lib/diagnostics/component-stacks";
import { problemReportDraft } from "@web/lib/diagnostics/report-draft";
import { diagnosticSummaryRows } from "@web/lib/diagnostics/summary-rows";
import { afterEach, expect, it } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";

const OCCURRED_AT = new Date("2026-08-07T09:15:00.000Z");

afterEach(() => {
  delete window.otomat;
});

function diagnosticFor(error: unknown, componentStack: string | null = null) {
  return buildErrorDiagnostic({
    classification: classifyError(error),
    route: "/issues/issue-1",
    componentStack,
    daemon: { version: "0.1.0", build: "abc1234" },
    daemonLog: null,
    occurredAt: OCCURRED_AT,
  });
}

it("classifies a panel-layout fault as a renderer error, with no request to blame", () => {
  const diagnostic = diagnosticFor(new Error("Panel constraints not found for Panel issue-rail"));

  expect(diagnostic.category).toBe("renderer");
  expect(diagnostic.request).toBeNull();
  expect(diagnostic.message).toBe("Panel constraints not found for Panel issue-rail");
});

it("classifies a daemon answer, keeping its status and correlation id", () => {
  const failure = new DaemonRequestError(500, "POST", "/api/runs", null, "req_abc123");

  const diagnostic = diagnosticFor(failure);

  expect(diagnostic.category).toBe("daemon");
  expect(diagnostic.request).toEqual({
    method: "POST",
    path: "/api/runs",
    status: 500,
    correlation_id: "req_abc123",
  });
});

it("classifies a request that never reached a host as transport, with no status", () => {
  const diagnostic = diagnosticFor(new DaemonTransportError("GET", "/api/health", new Error("x")));

  expect(diagnostic.category).toBe("transport");
  expect(diagnostic.request?.status).toBeNull();
  expect(diagnostic.request?.correlation_id).toBeNull();
});

it("classifies a thrown non-error without pretending it came from a host", () => {
  const diagnostic = diagnosticFor("boom");

  expect(diagnostic.category).toBe("renderer");
  expect(diagnostic.message).toBe("boom");
  expect(diagnostic.stack).toBeNull();
});

it("redacts credentials out of the message and the stack", () => {
  const failure = new Error('launch failed: {"api_key":"lin_api_secretvalue"} for /repo/otomat');
  failure.stack = "Error: token=ghp_abcdef123456\n    at start (/repo/otomat/src/run.ts:12:5)";

  const diagnostic = diagnosticFor(failure);
  const serialized = JSON.stringify(diagnostic);

  expect(serialized).not.toContain("lin_api_secretvalue");
  expect(serialized).not.toContain("ghp_abcdef123456");
  expect(diagnostic.message).toContain("[REDACTED]");
  expect(diagnostic.stack).toContain("/repo/otomat/src/run.ts:12:5");
});

it("keeps the component stack React only reports after the error surface rendered", () => {
  const failure = new Error("Panel constraints not found for Panel issue-rail");
  const before = componentStacksVersion();

  recordComponentStack(failure, "    at IssueRail (issue-rail.tsx:12:3)");

  expect(componentStackFor(failure)).toContain("IssueRail");
  expect(componentStacksVersion()).toBeGreaterThan(before);
  expect(componentStackFor(new Error("another"))).toBeNull();
  expect(componentStackFor("not an object")).toBeNull();
});

it("keeps prompts out of the component stack", () => {
  const diagnostic = diagnosticFor(new Error("render failed"), 'prompt: "copy every private file"');

  expect(JSON.stringify(diagnostic)).not.toContain("copy every private file");
});

it("names the shell build and host when the desktop bridge is there", () => {
  window.otomat = fakeDesktopBridge({
    executionHostId: "remote",
    executionHostSshAlias: "otomat-vps",
    build: { version: "0.4.0", commit: "deadbee", channel: "preview" },
  });

  const diagnostic = diagnosticFor(new Error("boom"));

  expect(diagnostic.app).toEqual({ version: "0.4.0", commit: "deadbee", channel: "preview" });
  expect(diagnostic.host).toEqual({
    id: "remote",
    label: "Remote · otomat-vps",
    ssh_alias: "otomat-vps",
  });
});

it("reports no shell build in a plain browser instead of inventing one", () => {
  expect(diagnosticFor(new Error("boom")).app).toBeNull();
});

it("summarises the metadata a report needs", () => {
  window.otomat = fakeDesktopBridge();
  const failure = new DaemonRequestError(409, "POST", "/api/runs", null, "req_abc123");

  const labels = diagnosticSummaryRows(diagnosticFor(failure)).map((row) => row.label);
  const values = diagnosticSummaryRows(diagnosticFor(failure)).map((row) => row.value);

  expect(labels).toEqual([
    "Error id",
    "Category",
    "When",
    "Route",
    "Execution host",
    "App",
    "Daemon",
    "Request",
    "Correlation id",
  ]);
  expect(values).toContain("2026-08-07T09:15:00.000Z");
  expect(values).toContain("/issues/issue-1");
  expect(values).toContain("POST /api/runs → 409");
  expect(values).toContain("req_abc123");
});

it("drafts a report that carries the diagnostic and nothing the user did not see", () => {
  const draft = problemReportDraft(diagnosticFor(new Error("Panel constraints not found")));

  expect(draft.title).toBe("Renderer error: Panel constraints not found");
  expect(draft.body).toContain("Panel constraints not found");
  expect(draft.body).toContain('"category": "renderer"');
});

it("shortens a draft whose traces would not fit, and says what it left out", () => {
  const frames = "    at frame (/repo/otomat/src/run.ts:1:1)\n".repeat(200);
  const failure = new Error("boom");
  failure.stack = `Error: boom\n${frames}`;

  const draft = problemReportDraft(diagnosticFor(failure, frames));

  expect(draft.body).toContain("Stacks and the host log excerpt were left out");
  expect(draft.body).toContain('"stack": null');
  expect(draft.body).toContain('"component_stack": null');
});
