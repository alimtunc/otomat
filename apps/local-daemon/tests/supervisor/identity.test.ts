import { existsSync } from "node:fs";

import { expect, it } from "vitest";

import { readProcessStartTime } from "#supervisor/identity";

import { deadPid } from "../support/spawn.js";

const onProc = existsSync("/proc/self/stat");

it("stamps a live pid with a value stable across reads", () => {
  const first = readProcessStartTime(process.pid);

  expect(first).not.toBeNull();
  expect(readProcessStartTime(process.pid)).toBe(first);
});

it.runIf(onProc)("stamps a live pid on a host that ships no ps, as the preview image is", () => {
  const path = process.env.PATH;
  process.env.PATH = "";
  try {
    expect(readProcessStartTime(process.pid)).not.toBeNull();
  } finally {
    process.env.PATH = path;
  }
});

it("reports no stamp for a pid that is gone", async () => {
  expect(readProcessStartTime(await deadPid())).toBeNull();
});
