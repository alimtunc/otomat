import { expect, it } from "vitest";

import { sameRemoteHostStatus } from "#domain/contracts/execution-host";

it("matches statuses field by field, per phase variant", () => {
  expect(
    sameRemoteHostStatus(
      { phase: "connected", detail: null },
      { phase: "connected", detail: null },
    ),
  ).toBe(true);
  expect(
    sameRemoteHostStatus(
      { phase: "waiting_for_runs", active_runs: 2, detail: null },
      { phase: "waiting_for_runs", active_runs: 2, detail: null },
    ),
  ).toBe(true);
});

it("tells apart a changed run count, error code, detail or phase", () => {
  expect(
    sameRemoteHostStatus(
      { phase: "waiting_for_runs", active_runs: 2, detail: null },
      { phase: "waiting_for_runs", active_runs: 1, detail: null },
    ),
  ).toBe(false);
  expect(
    sameRemoteHostStatus(
      { phase: "error", code: "tunnel_failed", detail: null },
      { phase: "error", code: "health_failed", detail: null },
    ),
  ).toBe(false);
  expect(
    sameRemoteHostStatus(
      { phase: "checking_host", detail: "ssh vps" },
      { phase: "checking_host", detail: null },
    ),
  ).toBe(false);
  expect(
    sameRemoteHostStatus(
      { phase: "connected", detail: null },
      { phase: "reconnecting", detail: null },
    ),
  ).toBe(false);
});

it("never matches a null: nothing seen yet is not a repeat", () => {
  expect(sameRemoteHostStatus({ phase: "connected", detail: null }, null)).toBe(false);
});
