import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { resolveAppPaths } from "#main/paths";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const harness = vi.hoisted(() => ({ packaged: false, appData: "/Users/dev/Library/App Support" }));

vi.mock("electron", () => ({
  app: {
    get isPackaged(): boolean {
      return harness.packaged;
    },
    getAppPath: () => "/Applications/Otomat.app/Contents/Resources/app.asar",
    getPath: (name: string) => {
      if (name !== "appData") throw new Error(`Unexpected path request: ${name}`);
      return harness.appData;
    },
  },
}));

const originalResourcesPath = process.resourcesPath;

beforeEach(() => {
  Object.defineProperty(process, "resourcesPath", {
    value: "/Applications/Otomat.app/Contents/Resources",
    configurable: true,
  });
});

afterEach(() => {
  harness.packaged = false;
  Object.defineProperty(process, "resourcesPath", {
    value: originalResourcesPath,
    configurable: true,
  });
  vi.unstubAllEnvs();
});

it("leaves the packaged app on its production userData and bundled daemon", () => {
  harness.packaged = true;
  vi.stubEnv("OTOMAT_DESKTOP_DEV_DATA_ROOT", "/tmp/should-be-ignored");

  const paths = resolveAppPaths();

  expect(paths.packaged).toBe(true);
  expect(paths.devDataRoot).toBeNull();
  expect(paths.daemonEntry).toBe(
    join(process.resourcesPath, "app.asar.unpacked", "daemon", "dist", "index.js"),
  );
  expect(paths.webDist).toBe(join(process.resourcesPath, "web"));
});

it("points a dev shell at its own worktree root and the daemon that worktree builds", () => {
  vi.stubEnv("OTOMAT_DESKTOP_DEV_DATA_ROOT", "");

  const paths = resolveAppPaths();

  expect(paths.packaged).toBe(false);
  expect(paths.devDataRoot?.startsWith(`${harness.appData}${sep}Otomat Dev${sep}`)).toBe(true);
  expect(paths.daemonEntry).toBe(join(REPO_ROOT, "apps", "local-daemon", "dist", "index.js"));
  expect(paths.webDist).toBeNull();
});
