// Distributable macOS artifact: Developer ID signed, notarized, stapled, then verified. Fails closed
// on a missing credential; it never falls back to the unsigned build.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildMacApp, resolveBuildInfo, REPO } from "./mac-build.mjs";
import { notarizeAndStapleDmg, verifySignedRelease } from "./release/gatekeeper.mjs";
import {
  createArtifactManifest,
  describeArtifact,
  resolveBuildIdentity,
} from "./release/metadata.mjs";
import { renderReleaseNotes } from "./release/notes.mjs";
import { preflight } from "./release/preflight.mjs";

/** Streams progress. Never reports argv or a spawn error: they carry the App Store Connect ids. */
function runStreamed(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error !== undefined) throw new Error(`\`${command}\` could not be started.`);
  if (result.status !== 0) {
    throw new Error(`\`${command} ${args[0]}\` exited with code ${String(result.status)}.`);
  }
}

/** Captures output so it can be parsed. `allowFailure` is for tools that report a verdict by code. */
function runCaptured(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error !== undefined) throw result.error;
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error(
      `\`${command} ${args[0]}\` exited with code ${String(result.status)}.\n${output}`,
    );
  }
  return output;
}

function changesSincePreviousTag() {
  const previous = spawnSync("git", ["describe", "--tags", "--abbrev=0", "HEAD^"], {
    cwd: REPO,
    encoding: "utf8",
  });
  if (previous.status !== 0) return [];
  const range = `${previous.stdout.trim()}..HEAD`;
  return execFileSync("git", ["log", "--no-merges", "--pretty=%s", range], {
    cwd: REPO,
    encoding: "utf8",
  })
    .split("\n")
    .filter((subject) => subject.trim().length > 0);
}

// The stable channel, passed explicitly: `OTOMAT_CHANNEL` can neither reach a release nor keep one
// out of the production data roots, and unsigned metadata claiming `stable` fails the build.
const buildInfo = resolveBuildInfo({ signed: true, channel: "stable" });
let signing;
try {
  signing = preflight({
    env: process.env,
    arch: process.arch,
    version: buildInfo.version,
    fileExists: existsSync,
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(
  `Releasing Otomat ${buildInfo.version} (${buildInfo.commit_short}, ${buildInfo.arch}).`,
);

// The stable identity, passed explicitly: a release is never renamed by a stray PR_NUMBER.
const built = buildMacApp({ buildInfo, signing, identity: resolveBuildIdentity(null) });

console.log("\nNotarizing the DMG…");
notarizeAndStapleDmg({ dmgPath: built.dmgPath, signing, run: runStreamed });

console.log("\nVerifying the artifact a clean machine will see…");
for (const check of verifySignedRelease({
  appPath: built.appPath,
  dmgPath: built.dmgPath,
  teamId: signing.teamId,
  run: runCaptured,
})) {
  console.log(`  ok — ${check}`);
}

const manifest = createArtifactManifest({
  buildInfo,
  notarized: true,
  artifacts: [describeArtifact(built.dmgPath)],
});
const manifestPath = join(built.releaseDir, "manifest.json");
const notesPath = join(built.releaseDir, "release-notes.md");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(notesPath, renderReleaseNotes({ manifest, changes: changesSincePreviousTag() }));

console.log(`\nRelease artifacts in ${built.releaseDir}`);
console.log(`  dmg:      ${built.dmgPath}`);
console.log(`  manifest: ${manifestPath}`);
console.log(`  notes:    ${notesPath}`);
