import { expect, it } from "vitest";

import { createArtifactManifest, createBuildInfo } from "#release/metadata";
import { renderReleaseNotes } from "#release/notes";

function manifest() {
  return createArtifactManifest({
    buildInfo: createBuildInfo({
      version: "0.1.0-alpha.1",
      commit: "a8deeb7aaaf2d3d701092399054e18cb73c56806",
      committedAt: "2026-07-27T21:00:00+02:00",
      arch: "arm64",
      electronVersion: "43.2.0",
      signed: true,
    }),
    notarized: true,
    artifacts: [{ name: "Otomat-0.1.0-alpha.1-arm64.dmg", bytes: 120_000_000, sha256: "d34db33f" }],
  });
}

it("tells a reader what to install, how to check it and how to back out", () => {
  const notes = renderReleaseNotes({ manifest: manifest(), changes: ["Add run cockpit"] });

  expect(notes).toContain("## Otomat 0.1.0-alpha.1 — macOS alpha (arm64)");
  expect(notes).toContain("notarized by Apple");
  expect(notes).toContain("a8deeb7aaaf2d3d701092399054e18cb73c56806");
  expect(notes).toContain("shasum -a 256 Otomat-0.1.0-alpha.1-arm64.dmg");
  expect(notes).toContain("spctl --assess --type execute -vv /Applications/Otomat.app");
  expect(notes).toContain("~/Library/Application Support/Otomat");
  expect(notes).toContain("- Add run cockpit");
  expect(notes).toContain("d34db33f");
});

it("says so plainly when there is no previous tag to compare against", () => {
  expect(renderReleaseNotes({ manifest: manifest(), changes: [] })).toContain(
    "First packaged alpha build.",
  );
});

it("never presents an unnotarized build as distributable", () => {
  const unsigned = { ...manifest(), notarized: false };

  expect(renderReleaseNotes({ manifest: unsigned, changes: [] })).toContain(
    "Unsigned local build — not distributable.",
  );
});
