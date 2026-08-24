import { expect, it } from "vitest";

import { describeInstallability, RELEASES_URL } from "#main/update/installability";
import type { BuildInfo } from "#shared/build-info";

function build(overrides: Partial<BuildInfo> = {}): BuildInfo {
  return {
    version: "0.1.0-alpha.1",
    commit: "a8deeb7aaaf2d3d701092399054e18cb73c56806",
    commit_short: "a8deeb7",
    committed_at: "2026-07-27T21:00:00+02:00",
    arch: "arm64",
    platform: "darwin",
    electron: "43.2.0",
    signed: true,
    pr_number: null,
    channel: "stable",
    ...overrides,
  };
}

const INSTALLED = "/Applications/Otomat.app/Contents/Resources/app.asar";

function describe(overrides: Partial<BuildInfo>, appPath = INSTALLED) {
  return describeInstallability({
    build: build(overrides),
    platform: "darwin",
    packaged: true,
    appPath,
  });
}

it("lets the signed stable app installed in Applications replace itself", () => {
  expect(describe({})).toEqual({ installable: true });
});

it("never lets a pull-request preview stand in for the installed app", () => {
  const result = describe({ channel: "preview", pr_number: 77, signed: false });
  expect(result).toEqual({ installable: false, reason: expect.stringContaining("77") });
});

it("refuses an unsigned build, whose replacement macOS would reject", () => {
  expect(describe({ channel: "local", signed: false })).toEqual({
    installable: false,
    reason: expect.stringContaining("signed release"),
  });
});

it("refuses a stable app running from outside Applications", () => {
  expect(describe({}, "/Users/me/Downloads/Otomat.app/Contents/Resources/app.asar")).toEqual({
    installable: false,
    reason: expect.stringContaining("Applications"),
  });
});

it("refuses a checkout and a platform that has no installer", () => {
  const checkout = describeInstallability({
    build: build(),
    platform: "darwin",
    packaged: false,
    appPath: INSTALLED,
  });
  expect(checkout).toEqual({ installable: false, reason: expect.stringContaining("checkout") });
  const linux = describeInstallability({
    build: build(),
    platform: "linux",
    packaged: true,
    appPath: INSTALLED,
  });
  expect(linux).toEqual({ installable: false, reason: expect.stringContaining("macOS") });
});

it("points a build that cannot update itself at the releases page", () => {
  expect(RELEASES_URL).toBe("https://github.com/alimtunc/otomat/releases/latest");
});
