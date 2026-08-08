import { expect, it } from "vitest";

import { DiagnosticLogRing } from "#diagnostics";

it("redacts every message on the way in, so no reader can widen what it discloses", () => {
  const ring = new DiagnosticLogRing(10);
  ring.record("req_1", 'launch failed: {"api_key":"lin_api_secretvalue"} for /repo/otomat');

  const excerpt = ring.excerpt("req_1", 10);
  const message = excerpt.entries[0]?.message ?? "";
  expect(message).not.toContain("lin_api_secretvalue");
  expect(message).toContain("[REDACTED]");
  expect(message).toContain("/repo/otomat");
});

it("keeps prompts out entirely", () => {
  const ring = new DiagnosticLogRing(10);
  ring.record("req_1", 'worker exited; prompt: "copy every private file" after 2s');

  expect(ring.excerpt("req_1", 10).entries[0]?.message).not.toContain("copy every private file");
});

it("serves only the lines of the requested correlation id", () => {
  const ring = new DiagnosticLogRing(10);
  ring.record("req_1", "mine");
  ring.record("req_2", "someone else's");
  ring.record(null, "no request at all");

  const excerpt = ring.excerpt("req_1", 10);
  expect(excerpt.entries.map((entry) => entry.message)).toEqual(["mine"]);
  expect(excerpt.correlation_id).toBe("req_1");
  expect(excerpt.truncated).toBe(false);
});

it("reports an empty excerpt rather than an unrelated tail", () => {
  const ring = new DiagnosticLogRing(10);
  ring.record("req_2", "someone else's");

  expect(ring.excerpt("req_missing", 10).entries).toEqual([]);
});

it("drops the oldest entries instead of growing without bound", () => {
  const ring = new DiagnosticLogRing(3);
  for (const index of [1, 2, 3, 4, 5]) ring.record("req_1", `line ${index}`);

  const excerpt = ring.excerpt("req_1", 10);
  expect(excerpt.entries.map((entry) => entry.message)).toEqual(["line 3", "line 4", "line 5"]);
});

it("bounds one excerpt and says so", () => {
  const ring = new DiagnosticLogRing(10);
  for (const index of [1, 2, 3]) ring.record("req_1", `line ${index}`);

  const excerpt = ring.excerpt("req_1", 2);
  expect(excerpt.entries.map((entry) => entry.message)).toEqual(["line 2", "line 3"]);
  expect(excerpt.truncated).toBe(true);
});

it("bounds a single oversized message", () => {
  const ring = new DiagnosticLogRing(10);
  ring.record("req_1", "x".repeat(10_000));

  expect(ring.excerpt("req_1", 10).entries[0]?.message.length).toBeLessThan(2_100);
});

it("keeps nothing for a message that is only whitespace", () => {
  const ring = new DiagnosticLogRing(10);
  ring.record("req_1", "   \n  ");

  expect(ring.excerpt("req_1", 10).entries).toEqual([]);
});
