import { afterEach, beforeEach, expect, it } from "vitest";

import {
  readMaxConcurrentSessions,
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

it("refuses a cap that is not a positive integer, leaving the stored one intact", () => {
  writeMaxConcurrentSessions(t.client.db, 3);

  for (const value of [0, -1, 2.5, Number.NaN]) {
    expect(() => writeMaxConcurrentSessions(t.client.db, value)).toThrow(RangeError);
  }

  expect(readMaxConcurrentSessions(t.client.db)).toBe(3);
});
