import { spawn } from "node:child_process";

import { afterEach, expect, it } from "vitest";

import { descendantPids, describeProcesses, tail, terminate } from "#scripts/smoke/harness";

const running = [];

function start(source) {
  const child = spawn(process.execPath, ["-e", source], { stdio: ["ignore", "pipe", "pipe"] });
  running.push(child);
  return child;
}

function exitOf(child) {
  return new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
}

afterEach(() => {
  for (const child of running) child.kill("SIGKILL");
  running.length = 0;
});

it("stops a live child and reports how it went", async () => {
  const child = start("setInterval(() => {}, 1000)");
  const outcome = await terminate(child, "the test child");
  expect(outcome.signal).toBe("SIGTERM");
});

it("names a child that was already gone instead of accusing it of ignoring SIGTERM", async () => {
  const child = start("process.exit(3)");
  await exitOf(child);
  await expect(terminate(child, "the test child", () => "  output:\n  boom")).rejects.toThrow(
    /the test child had already exited \(code 3, signal null\) before SIGTERM\.\n  output:\n  boom/,
  );
});

it("keeps the shutdown error when the evidence itself cannot be read", async () => {
  const child = start("process.exit(0)");
  await exitOf(child);
  await expect(
    terminate(child, "the test child", () => {
      throw new Error("no log directory");
    }),
  ).rejects.toThrow(/before SIGTERM\.\n {2}\(evidence unavailable: Error: no log directory\)/);
});

it("finds every descendant of a stuck process, not just its direct children", async () => {
  const child = start(
    "require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']); setInterval(() => {}, 1000)",
  );
  const found = await new Promise((resolve) => {
    const poll = setInterval(() => {
      const pids = descendantPids(child.pid);
      if (pids.length >= 1) {
        clearInterval(poll);
        resolve(pids);
      }
    }, 50);
  });

  const table = describeProcesses([String(child.pid), ...found]);
  expect(table).toContain(String(child.pid));
  for (const pid of found) expect(table).toContain(pid);
});

it("keeps only the tail of a captured stream", () => {
  expect(tail("one\ntwo\nthree\n", 2)).toBe("  two\n  three");
  expect(tail("", 2)).toBe("  (empty)");
});
