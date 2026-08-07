import { expect, it } from "vitest";

import {
  assertMacHost,
  assertReleasableArch,
  assertTagMatchesVersion,
  createArtifactManifest,
  createBuildInfo,
  PACKAGED_CHANNELS,
  readPrNumber,
  resolveBuildIdentity,
  resolvePackagedChannel,
  SUPPORTED_RELEASE_ARCHS,
} from "#release/metadata";
import { parseBuildInfo } from "#shared/build-info";

const BUILD = {
  version: "0.1.0-alpha.1",
  commit: "a8deeb7aaaf2d3d701092399054e18cb73c56806",
  committedAt: "2026-07-27T21:00:00+02:00",
  arch: "arm64",
  electronVersion: "43.2.0",
  signed: true,
  channel: "stable",
};

it("refuses to package anywhere but macOS", () => {
  expect(() => assertMacHost("darwin")).not.toThrow();
  expect(() => assertMacHost("linux")).toThrow(/this one is linux/);
});

it("releases only the architectures the pipeline can actually build", () => {
  for (const arch of SUPPORTED_RELEASE_ARCHS) {
    expect(() => assertReleasableArch(arch)).not.toThrow();
  }
  expect(() => assertReleasableArch("x64")).toThrow(/this host is x64/);
});

it("refuses a tag that disagrees with the packaged version", () => {
  expect(() => assertTagMatchesVersion("refs/tags/v0.1.0-alpha.1", "0.1.0-alpha.1")).not.toThrow();
  expect(() => assertTagMatchesVersion("refs/tags/v0.2.0", "0.1.0-alpha.1")).toThrow(
    /Tag v0\.2\.0 does not match the packaged version 0\.1\.0-alpha\.1/,
  );
});

it("leaves untagged runs alone", () => {
  expect(() => assertTagMatchesVersion("refs/heads/main", "0.1.0-alpha.1")).not.toThrow();
  expect(() => assertTagMatchesVersion(undefined, "0.1.0-alpha.1")).not.toThrow();
});

it("ties the build to its commit and its channel", () => {
  const info = createBuildInfo(BUILD);

  expect(info).toEqual({
    version: "0.1.0-alpha.1",
    commit: BUILD.commit,
    commit_short: "a8deeb7",
    committed_at: BUILD.committedAt,
    arch: "arm64",
    platform: "darwin",
    electron: "43.2.0",
    signed: true,
    pr_number: null,
    channel: "stable",
  });
  expect(createBuildInfo({ ...BUILD, signed: false, channel: "preview", pr: 77 }).pr_number).toBe(
    77,
  );
});

it("refuses to write metadata the app would have to refuse", () => {
  expect(() => createBuildInfo({ ...BUILD, channel: "nightly" })).toThrow(/must declare a channel/);
  expect(() => createBuildInfo({ ...BUILD, signed: false })).toThrow(/must be Developer ID signed/);
  expect(() => createBuildInfo({ ...BUILD, signed: false, channel: "preview" })).toThrow(
    /disagree/,
  );
  expect(() => createBuildInfo({ ...BUILD, signed: false, channel: "local", pr: 77 })).toThrow(
    /disagree/,
  );
});

it("writes metadata the app's own parser accepts, on every channel", () => {
  const written = [
    createBuildInfo(BUILD),
    createBuildInfo({ ...BUILD, signed: false, channel: "local" }),
    createBuildInfo({ ...BUILD, signed: false, channel: "preview", pr: 79 }),
  ];

  for (const info of written) {
    expect(parseBuildInfo(JSON.stringify(info))).toEqual(info);
  }
  expect(written.map((info) => info.channel).sort()).toEqual([...PACKAGED_CHANNELS].sort());
});

it("packages a preview only for a pull request, and everything else as local", () => {
  expect(resolvePackagedChannel({}, null)).toBe("local");
  expect(resolvePackagedChannel({ OTOMAT_CHANNEL: "local" }, null)).toBe("local");
  expect(resolvePackagedChannel({}, 79)).toBe("preview");
  expect(resolvePackagedChannel({ OTOMAT_CHANNEL: "preview" }, 79)).toBe("preview");
});

it("refuses a channel that contradicts PR_NUMBER, or names nothing real", () => {
  expect(() => resolvePackagedChannel({ OTOMAT_CHANNEL: "local" }, 79)).toThrow(
    /packages a preview/,
  );
  expect(() => resolvePackagedChannel({ OTOMAT_CHANNEL: "preview" }, null)).toThrow(
    /set PR_NUMBER/,
  );
  expect(() => resolvePackagedChannel({ OTOMAT_CHANNEL: "beta" }, null)).toThrow(
    /must be one of preview, local, stable/,
  );
});

it("reads PR_NUMBER, or fails rather than silently packaging the stable identity", () => {
  expect(readPrNumber({})).toBeNull();
  expect(readPrNumber({ PR_NUMBER: "" })).toBeNull();
  expect(readPrNumber({ PR_NUMBER: " 77 " })).toBe(77);
  expect(() => readPrNumber({ PR_NUMBER: "main" })).toThrow(/pull request number/);
  expect(() => readPrNumber({ PR_NUMBER: "0" })).toThrow(/pull request number/);
});

it("names a preview after its pull request and leaves the stable identity alone", () => {
  expect(resolveBuildIdentity(null)).toEqual({
    pr: null,
    productName: "Otomat",
    appId: "com.otomat.desktop",
  });
  expect(resolveBuildIdentity(77)).toEqual({
    pr: 77,
    productName: "Otomat PR 77",
    appId: "com.otomat.desktop.pr77",
  });
  expect(resolveBuildIdentity(78).appId).not.toBe(resolveBuildIdentity(77).appId);
});

it("publishes the artifact identity alongside the build identity", () => {
  const manifest = createArtifactManifest({
    buildInfo: createBuildInfo(BUILD),
    notarized: true,
    artifacts: [{ name: "Otomat-0.1.0-alpha.1-arm64.dmg", bytes: 120, sha256: "abc" }],
  });

  expect(manifest.product).toBe("Otomat");
  expect(manifest.app_id).toBe("com.otomat.desktop");
  expect(manifest.notarized).toBe(true);
  expect(manifest.build.commit).toBe(BUILD.commit);
  expect(manifest.artifacts[0].name).toBe("Otomat-0.1.0-alpha.1-arm64.dmg");
});
