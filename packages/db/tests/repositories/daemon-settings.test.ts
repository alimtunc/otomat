import { afterEach, beforeEach, expect, it } from "vitest";

import {
  readExecutionDefaults,
  readMaxConcurrentSessions,
  writeExecutionDefaults,
  writeMaxConcurrentSessions,
} from "#db/repositories/daemon-settings";

import { createTempDb, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-daemon-settings-");
});

afterEach(() => {
  t.cleanup();
});

it("answers the shipped default until the host is configured", () => {
  expect(readMaxConcurrentSessions(t.client.db)).toBe(4);
});

it("keeps the last saved cap, overwriting the single settings row", () => {
  writeMaxConcurrentSessions(t.client.db, 6);
  expect(readMaxConcurrentSessions(t.client.db)).toBe(6);

  writeMaxConcurrentSessions(t.client.db, 2);
  expect(readMaxConcurrentSessions(t.client.db)).toBe(2);
});

it("selects no execution default until the host is configured", () => {
  expect(readExecutionDefaults(t.client.db)).toEqual({ runtime: null, model: null, options: {} });
});

it("keeps the execution defaults and the cap in the one settings row, neither clearing the other", () => {
  writeMaxConcurrentSessions(t.client.db, 6);
  writeExecutionDefaults(t.client.db, {
    runtime: "claude",
    model: "opus",
    options: { permission_mode: "plan" },
  });

  expect(readExecutionDefaults(t.client.db)).toEqual({
    runtime: "claude",
    model: "opus",
    options: { permission_mode: "plan" },
  });
  expect(readMaxConcurrentSessions(t.client.db)).toBe(6);

  writeExecutionDefaults(t.client.db, { runtime: null, model: null, options: {} });
  expect(readExecutionDefaults(t.client.db)).toEqual({
    runtime: null,
    model: null,
    options: {},
  });
  expect(readMaxConcurrentSessions(t.client.db)).toBe(6);
});

it("refuses a cap that is not a positive integer, leaving the stored one intact", () => {
  writeMaxConcurrentSessions(t.client.db, 3);

  for (const value of [0, -1, 2.5, Number.NaN]) {
    expect(() => writeMaxConcurrentSessions(t.client.db, value)).toThrow(RangeError);
  }

  expect(readMaxConcurrentSessions(t.client.db)).toBe(3);
});
