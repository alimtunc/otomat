import type { DesktopUpdateRelease, DesktopUpdateSnapshot } from "@otomat/domain";
import { expect, it, vi } from "vitest";

import { DesktopUpdater, type UpdaterPort } from "#main/update/controller";
import type { GateVerdict, UpdateGate } from "#main/update/gate";
import type { Installability } from "#main/update/installability";
import { scratchDir } from "#support/scratch-dir";

const CURRENT = "0.1.0-alpha.1";

const CLEAR: GateVerdict = { clear: true };

const NEXT: DesktopUpdateRelease = {
  version: "0.1.0-alpha.2",
  notes: "## Fixes\n- one",
  released_at: "2026-08-22T09:00:00.000Z",
};

interface Harness {
  updater: DesktopUpdater;
  states: DesktopUpdateSnapshot[];
  quit: ReturnType<typeof vi.fn>;
  arm: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function harness(options: {
  found?: DesktopUpdateRelease | null;
  checkFails?: Error;
  downloadFails?: Error;
  observe?: GateVerdict;
  arm?: GateVerdict;
  installability?: Installability;
  /** Percentages the download reports while it runs. */
  downloadProgress?: number[];
}): Harness {
  const states: DesktopUpdateSnapshot[] = [];
  const quit = vi.fn();
  const arm = vi.fn(async (): Promise<GateVerdict> => options.arm ?? CLEAR);
  const release = vi.fn(async () => {});
  let emit: ((percent: number) => void) | null = null;
  const port: UpdaterPort = {
    check: async () => {
      if (options.checkFails) throw options.checkFails;
      return options.found ?? null;
    },
    download: async () => {
      for (const percent of options.downloadProgress ?? []) emit?.(percent);
      if (options.downloadFails) throw options.downloadFails;
    },
    quitAndInstall: quit,
    onProgress: (listener) => (emit = listener),
  };
  const gate: Pick<UpdateGate, "arm" | "observe" | "release"> = {
    observe: async () => options.observe ?? CLEAR,
    arm,
    release,
  };
  const updater = new DesktopUpdater({
    currentVersion: CURRENT,
    installability: options.installability ?? { installable: true },
    dataDir: scratchDir("otomat-update-"),
    gate,
    port,
    onChange: (snapshot) => states.push(snapshot),
    log: () => {},
  });
  return { updater, states, quit, arm, release };
}

it("starts on manual only when this build cannot replace itself, and checks nothing", async () => {
  const test = harness({
    installability: { installable: false, reason: "not the signed release" },
    found: NEXT,
  });
  await test.updater.check();

  const snapshot = test.updater.snapshot();
  expect(snapshot.state).toBe("manual_only");
  expect(snapshot.detail).toBe("not the signed release");
  expect(snapshot.manual_url).not.toBeNull();
  expect(test.states).toHaveLength(0);
});

it("reports up to date when the feed offers nothing newer", async () => {
  const test = harness({ found: null });
  await test.updater.check();

  expect(test.states.map((state) => state.state)).toEqual(["checking", "up_to_date"]);
  expect(test.updater.snapshot().checked_at).not.toBeNull();
});

it("names a release on the other feed instead of hiding it behind up to date", async () => {
  const test = harness({ found: { ...NEXT, version: "0.2.0" } });
  await test.updater.check();

  const snapshot = test.updater.snapshot();
  expect(snapshot.state).toBe("up_to_date");
  expect(snapshot.detail).toContain("stable channel");
  expect(snapshot.release).toBeNull();
});

it("downloads a newer release by itself and stops at ready", async () => {
  const test = harness({ found: NEXT });
  await test.updater.check();

  expect(test.states.map((state) => state.state)).toEqual([
    "checking",
    "available",
    "downloading",
    "ready",
  ]);
  expect(test.updater.snapshot().release).toEqual(NEXT);
  expect(test.quit).not.toHaveBeenCalled();
});

it("reports whole-percent progress while downloading, and drops it once done", async () => {
  const test = harness({ found: NEXT, downloadProgress: [42.4, 42.2, 99.6] });
  await test.updater.check();

  const percents = test.states.map((state) => state.progress);
  expect(percents.filter((percent) => percent !== null)).toEqual([0, 42, 100]);
  expect(test.updater.snapshot().progress).toBeNull();
});

it("shows what is in the way as soon as the download lands", async () => {
  const test = harness({
    found: NEXT,
    observe: { clear: false, reason: "otomat-vps still has 1 run in flight." },
  });
  await test.updater.check();

  const snapshot = test.updater.snapshot();
  expect(snapshot.state).toBe("waiting_for_runs");
  expect(snapshot.detail).toBe("otomat-vps still has 1 run in flight.");
});

it("keeps the current app when the second check finds a launch, and lifts the hold", async () => {
  const test = harness({
    found: NEXT,
    arm: { clear: false, reason: "Local still has 1 run in flight." },
  });
  await test.updater.check();
  await test.updater.install();

  expect(test.quit).not.toHaveBeenCalled();
  expect(test.release).toHaveBeenCalledTimes(1);
  expect(test.updater.snapshot()).toMatchObject({
    state: "waiting_for_runs",
    detail: "Local still has 1 run in flight.",
  });
});

it("replaces the app only once the hold is armed and every host is idle", async () => {
  const test = harness({ found: NEXT });
  await test.updater.check();
  await test.updater.install();

  expect(test.arm).toHaveBeenCalledTimes(1);
  expect(test.quit).toHaveBeenCalledTimes(1);
  expect(test.release).not.toHaveBeenCalled();
});

it("refuses to install anything that is not downloaded and waiting", async () => {
  const test = harness({ found: null });
  await test.updater.check();
  await test.updater.install();

  expect(test.arm).not.toHaveBeenCalled();
  expect(test.quit).not.toHaveBeenCalled();
});

it("leaves the current version in place when the download fails", async () => {
  const test = harness({ found: NEXT, downloadFails: new Error("sha512 mismatch") });
  await test.updater.check();

  expect(test.updater.snapshot()).toMatchObject({
    state: "failed",
    detail: "sha512 mismatch",
    progress: null,
  });
  expect(test.quit).not.toHaveBeenCalled();
});

it("leaves the current version in place when the feed cannot be read", async () => {
  const test = harness({ checkFails: new Error("latest-mac.yml not found") });
  await test.updater.check();

  expect(test.updater.snapshot()).toMatchObject({
    state: "failed",
    detail: "latest-mac.yml not found",
  });
});
