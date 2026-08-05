import { expect, it } from "vitest";

import { parseBuildInfo, unidentifiedBuildInfo } from "#shared/build-info";

const PACKAGED = {
  version: "0.1.0-alpha.1",
  commit: "a8deeb7aaaf2d3d701092399054e18cb73c56806",
  commit_short: "a8deeb7",
  committed_at: "2026-07-27T21:00:00+02:00",
  arch: "arm64",
  platform: "darwin",
  electron: "43.2.0",
  signed: true,
};

it("reads the metadata packaging wrote into the app", () => {
  expect(parseBuildInfo(JSON.stringify(PACKAGED))).toEqual({ ...PACKAGED, pr_number: null });
});

it("carries the pull request a preview was packaged for", () => {
  expect(parseBuildInfo(JSON.stringify({ ...PACKAGED, pr_number: 77 })).pr_number).toBe(77);
  expect(parseBuildInfo(JSON.stringify({ ...PACKAGED, pr_number: null })).pr_number).toBeNull();
  expect(() => parseBuildInfo(JSON.stringify({ ...PACKAGED, pr_number: "77" }))).toThrow(
    /pr_number is not a pull request number/,
  );
});

it("refuses metadata that cannot identify the build", () => {
  const { commit: _commit, ...withoutCommit } = PACKAGED;

  expect(() => parseBuildInfo(JSON.stringify(withoutCommit))).toThrow(/commit is missing/);
  expect(() => parseBuildInfo(JSON.stringify({ ...PACKAGED, signed: "yes" }))).toThrow(
    /signed is missing/,
  );
  expect(() => parseBuildInfo("[]")).toThrow(/version is missing/);
  expect(() => parseBuildInfo("null")).toThrow(/not an object/);
});

it("claims no commit and no signature when the build cannot identify itself", () => {
  const info = unidentifiedBuildInfo("0.1.0-alpha.1", "43.2.0");

  expect(info.commit).toBe("unknown");
  expect(info.signed).toBe(false);
  expect(info.version).toBe("0.1.0-alpha.1");
});
