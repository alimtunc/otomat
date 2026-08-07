import { expect, it } from "vitest";

import { devBuildInfo, parseBuildInfo, unidentifiedBuildInfo } from "#shared/build-info";

const PACKAGED = {
  version: "0.1.0-alpha.1",
  commit: "a8deeb7aaaf2d3d701092399054e18cb73c56806",
  commit_short: "a8deeb7",
  committed_at: "2026-07-27T21:00:00+02:00",
  arch: "arm64",
  platform: "darwin",
  electron: "43.2.0",
  signed: true,
  channel: "stable",
};

it("reads the metadata packaging wrote into the app", () => {
  expect(parseBuildInfo(JSON.stringify(PACKAGED))).toEqual({ ...PACKAGED, pr_number: null });
});

it("carries the channel the build declared", () => {
  const local = { ...PACKAGED, signed: false, channel: "local" };
  const preview = { ...local, channel: "preview", pr_number: 79 };

  expect(parseBuildInfo(JSON.stringify(local)).channel).toBe("local");
  expect(parseBuildInfo(JSON.stringify(preview)).channel).toBe("preview");
  expect(parseBuildInfo(JSON.stringify(preview)).pr_number).toBe(79);
});

it("refuses metadata with no channel, so signature can never stand in for one", () => {
  const { channel: _channel, ...withoutChannel } = PACKAGED;

  expect(() => parseBuildInfo(JSON.stringify(withoutChannel))).toThrow(
    /channel is not a distribution channel/,
  );
  expect(() => parseBuildInfo(JSON.stringify({ ...PACKAGED, channel: "dev" }))).toThrow(
    /channel is not a distribution channel/,
  );
  expect(() => parseBuildInfo(JSON.stringify({ ...PACKAGED, channel: "unknown" }))).toThrow(
    /channel is not a distribution channel/,
  );
});

it("refuses a stable build that is not signed", () => {
  expect(() => parseBuildInfo(JSON.stringify({ ...PACKAGED, signed: false }))).toThrow(
    /stable channel without a signature/,
  );
});

it("ties the pull request to the preview channel in both directions", () => {
  const preview = { ...PACKAGED, signed: false, channel: "preview" };

  expect(() => parseBuildInfo(JSON.stringify(preview))).toThrow(
    /preview channel without a pull request/,
  );
  expect(() => parseBuildInfo(JSON.stringify({ ...PACKAGED, pr_number: 79 }))).toThrow(
    /pull request outside the preview channel/,
  );
  expect(() => parseBuildInfo(JSON.stringify({ ...preview, pr_number: "79" }))).toThrow(
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

it("separates a checkout from a packaged build that named nothing", () => {
  expect(devBuildInfo("0.1.0-alpha.1", "43.2.0").channel).toBe("dev");

  const unidentified = unidentifiedBuildInfo("0.1.0-alpha.1", "43.2.0");

  expect(unidentified.channel).toBe("unknown");
  expect(unidentified.commit).toBe("unknown");
  expect(unidentified.signed).toBe(false);
  expect(unidentified.version).toBe("0.1.0-alpha.1");
});
