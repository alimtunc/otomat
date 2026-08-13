import { permissionDenials } from "@web/lib/run/permission-denial";
import { expect, it } from "vitest";

import { envelope } from "#support/envelope";

const REFUSED_RESULT = envelope({
  id: "e1",
  seq: 1,
  type: "runtime.tool_call",
  payload: {
    phase: "result",
    tool_use_id: "tu1",
    is_error: true,
    result: "Claude requested permissions to use Bash, but you haven't granted it yet.",
  },
});

const REQUEST = envelope({
  id: "e2",
  seq: 2,
  type: "runtime.permission_request",
  payload: {
    tool: "Bash",
    tool_use_id: "tu1",
    permission_mode: "acceptEdits",
    permission_mode_status: "supervised",
  },
});

const DENIED = envelope({
  id: "e3",
  seq: 3,
  type: "runtime.permission_response",
  payload: { tool_use_id: "tu1", decision: "denied", decided_by: "provider" },
});

it("joins a refusal to the provider's own words by tool use id", () => {
  expect(permissionDenials([REFUSED_RESULT, REQUEST, DENIED])).toEqual([
    {
      id: "e3",
      tool: "Bash",
      mode: "acceptEdits",
      status: "supervised",
      reason: "Claude requested permissions to use Bash, but you haven't granted it yet.",
    },
  ]);
});

it("keeps a refusal whose reason never arrived rather than dropping it", () => {
  const denial = permissionDenials([REQUEST, DENIED])[0];
  expect(denial?.tool).toBe("Bash");
  expect(denial?.reason).toBeNull();
});

it("reports nothing for a request the runtime answered with anything but a denial", () => {
  const granted = envelope({
    id: "e4",
    type: "runtime.permission_response",
    payload: { request_id: "perm-1", decision: "approved", auto: true },
  });
  const asked = envelope({
    id: "e5",
    type: "runtime.permission_request",
    payload: { request_id: "perm-1", action: "write_file", path: "src/index.ts" },
  });

  expect(permissionDenials([asked, granted])).toEqual([]);
});

it("diagnoses nothing for a refusal whose request never arrived", () => {
  const orphan = envelope({
    id: "e9",
    type: "runtime.permission_response",
    payload: { tool_use_id: "tu4", decision: "denied" },
  });

  expect(permissionDenials([orphan])).toEqual([
    { id: "e9", tool: "an unnamed tool", mode: null, status: null, reason: null },
  ]);
});

it("ignores a successful tool result and reports nothing for a run that was never blocked", () => {
  const ok = envelope({
    id: "e6",
    type: "runtime.tool_call",
    payload: { phase: "result", tool_use_id: "tu2" },
  });
  expect(permissionDenials([ok])).toEqual([]);
});

it("reads a payload with no status as an unfrozen mode rather than claiming one", () => {
  const bare = envelope({
    id: "e7",
    type: "runtime.permission_request",
    payload: { tool: "Bash", tool_use_id: "tu3" },
  });
  const denied = envelope({
    id: "e8",
    type: "runtime.permission_response",
    payload: { tool_use_id: "tu3", decision: "denied" },
  });

  expect(permissionDenials([bare, denied])[0]?.status).toBe("unfrozen");
});
