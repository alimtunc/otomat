import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { RotatingLog } from "#main/data-safety/rotating-log";
import { StartupLogSink } from "#main/startup-log-sink";

let scratch: string | null = null;

afterEach(() => {
  vi.restoreAllMocks();
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("buffers messages while no rotating log exists yet", () => {
  const sink = new StartupLogSink(() => null);

  sink.write("data_directory_invalid: the managed data directory could not be prepared");

  expect(sink.read()).toContain("data_directory_invalid");
});

it("keeps the message and reports a failing log only once", () => {
  const failing = {
    write: () => {
      throw new Error("injected log write failure");
    },
  } as unknown as RotatingLog;
  const reported = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const sink = new StartupLogSink(() => failing);

  sink.write("first failure");
  sink.write("second failure");

  expect(reported).toHaveBeenCalledTimes(1);
  expect(sink.read()).toContain("first failure");
  expect(sink.read()).toContain("second failure");
});

it("redacts what it buffers", () => {
  const sink = new StartupLogSink(() => null);

  sink.write("authorization: Bearer abc123secret");

  expect(sink.read()).toContain("[REDACTED]");
  expect(sink.read()).not.toContain("abc123secret");
});

it("bounds the buffer so a failing startup cannot grow it without limit", () => {
  const sink = new StartupLogSink(() => null);

  for (let entry = 0; entry < 400; entry += 1) sink.write("x".repeat(1024));

  expect(sink.read().length).toBeLessThanOrEqual(65_536);
});

it("writes through to the rotating log once the data directory exists", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-startup-sink-"));
  const log = new RotatingLog(join(scratch, "desktop.log"), { maxBytes: 4096, archives: 1 });
  const sink = new StartupLogSink(() => log);

  sink.write("daemon started");

  expect(log.read()).toContain("daemon started");
  expect(sink.read()).toBe("");
});
