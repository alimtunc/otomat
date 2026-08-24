// Distributable macOS artifact: Developer ID signed, notarized, stapled, then verified. Fails closed
// on a missing credential; it never falls back to the unsigned build.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildMacApp, resolveBuildInfo, REPO } from "./mac-build.mjs";
import { notarizeAndStapleDmg, verifySignedRelease } from "./release/gatekeeper.mjs";
import {
  createArtifactManifest,
  describeArtifact,
  resolveBuildIdentity,
  sha512OfFile,
} from "./release/metadata.mjs";
import { renderReleaseNotes } from "./release/notes.mjs";
import { preflight } from "./release/preflight.mjs";
import { assertUpdateFeed, UPDATE_FEED_FILE } from "./release/update-feed.mjs";

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

console.log("\nChecking the update feed an installed app will follow…");
const feedPath = join(built.releaseDir, UPDATE_FEED_FILE);
if (!existsSync(feedPath)) {
  throw new Error(
    `${UPDATE_FEED_FILE} is missing from ${built.releaseDir}. electron-builder emits it from the ` +
      "publish provider in `builderConfig`; a release without it can never update anyone.",
  );
}
const updateArtifacts = assertUpdateFeed({
  feedText: readFileSync(feedPath, "utf8"),
  version: buildInfo.version,
  present: new Set(readdirSync(built.releaseDir)),
  digestOf: (name) => sha512OfFile(join(built.releaseDir, name)),
});
for (const name of updateArtifacts) console.log(`  ok — ${name}`);

const manifest = createArtifactManifest({
  buildInfo,
  notarized: true,
  artifacts: [
    built.dmgPath,
    feedPath,
    ...updateArtifacts.map((n) => join(built.releaseDir, n)),
  ].map(describeArtifact),
});
const manifestPath = join(built.releaseDir, "manifest.json");
const notesPath = join(built.releaseDir, "release-notes.md");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(notesPath, renderReleaseNotes({ manifest, changes: changesSincePreviousTag() }));

console.log(`\nRelease artifacts in ${built.releaseDir}`);
console.log(`  dmg:      ${built.dmgPath}`);
console.log(`  feed:     ${feedPath}`);
console.log(`  manifest: ${manifestPath}`);
console.log(`  notes:    ${notesPath}`);
