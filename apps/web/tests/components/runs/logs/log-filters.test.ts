import {
  countMatching,
  isErrorLogEvent,
  logCategory,
  matchesLogFilter,
} from "@web/components/runs/logs/log-filters";
import { describe, expect, it } from "vitest";

import { envelope } from "#support/envelope";

describe("logCategory", () => {
  it("maps runtime families onto provider, tool, permission and usage", () => {
    expect(logCategory(envelope({ type: "runtime.message" }))).toBe("provider");
    expect(logCategory(envelope({ type: "runtime.log" }))).toBe("provider");
    expect(logCategory(envelope({ type: "runtime.provider_session" }))).toBe("provider");
    expect(logCategory(envelope({ type: "runtime.tool_call" }))).toBe("tool");
    expect(logCategory(envelope({ type: "runtime.permission_request" }))).toBe("permission");
    expect(logCategory(envelope({ type: "runtime.permission_response" }))).toBe("permission");
    expect(logCategory(envelope({ type: "runtime.usage" }))).toBe("usage");
  });

  it("maps lifecycle, git, review, pr and system events onto control", () => {
    expect(logCategory(envelope({ type: "run.lifecycle" }))).toBe("control");
    expect(logCategory(envelope({ type: "git.diff_updated" }))).toBe("control");
    expect(logCategory(envelope({ type: "pr.created" }))).toBe("control");
    expect(logCategory(envelope({ type: "system.reconciled" }))).toBe("control");
  });
});

describe("isErrorLogEvent", () => {
  it("flags failed tool calls", () => {
    expect(
      isErrorLogEvent(envelope({ type: "runtime.tool_call", payload: { is_error: true } })),
    ).toBe(true);
    expect(isErrorLogEvent(envelope({ type: "runtime.tool_call", payload: {} }))).toBe(false);
  });

  it("flags lifecycle events that settle on failed", () => {
    expect(
      isErrorLogEvent(envelope({ type: "run.lifecycle", payload: { final_status: "failed" } })),
    ).toBe(true);
    expect(
      isErrorLogEvent(envelope({ type: "run.lifecycle", payload: { final_status: "succeeded" } })),
    ).toBe(false);
  });
});

describe("matchesLogFilter / countMatching", () => {
  const events = [
    envelope({ seq: 1, type: "runtime.message" }),
    envelope({ seq: 2, type: "runtime.tool_call", payload: { is_error: true } }),
    envelope({ seq: 3, type: "run.lifecycle", payload: { final_status: "failed" } }),
  ];

  it("matches everything on all", () => {
    expect(countMatching(events, "all")).toBe(3);
  });

  it("cuts errors across categories", () => {
    expect(events.filter((event) => matchesLogFilter(event, "error")).map((e) => e.seq)).toEqual([
      2, 3,
    ]);
  });

  it("filters by category", () => {
    expect(countMatching(events, "provider")).toBe(1);
    expect(countMatching(events, "tool")).toBe(1);
    expect(countMatching(events, "control")).toBe(1);
    expect(countMatching(events, "usage")).toBe(0);
  });
});
