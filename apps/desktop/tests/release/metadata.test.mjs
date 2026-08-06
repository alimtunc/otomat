import { expect, it } from "vitest";

import {
  assertMacHost,
  assertReleasableArch,
  assertTagMatchesVersion,
  createArtifactManifest,
  createBuildInfo,
  readPrNumber,
  resolveBuildIdentity,
  SUPPORTED_RELEASE_ARCHS,
} from "#release/metadata";

const BUILD = {
  version: "0.1.0-alpha.1",
  commit: "a8deeb7aaaf2d3d701092399054e18cb73c56806",
  committedAt: "2026-07-27T21:00:00+02:00",
  arch: "arm64",
  electronVersion: "43.2.0",
  signed: true,
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

it("ties the build to its commit", () => {
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
  });
  expect(createBuildInfo({ ...BUILD, signed: false, pr: 77 }).pr_number).toBe(77);
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
