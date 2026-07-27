// Distributable macOS artifact: Developer ID signed, notarized, stapled, then verified before it is
// allowed to exist as a release. Fails closed when any Apple credential is missing — it never falls
// back to the unsigned build, so a release can never be an unsigned artifact wearing release clothes.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildMacApp, resolveBuildInfo, REPO } from "./mac-build.mjs";
import { notarizeAndStapleDmg, verifySignedRelease } from "./release/gatekeeper.mjs";
import { createArtifactManifest, describeArtifact } from "./release/metadata.mjs";
import { renderReleaseNotes } from "./release/notes.mjs";
import { preflight } from "./release/preflight.mjs";

/** Streams output: notarytool and stapler report progress and never name the signing identity. */
function runStreamed(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
  return "";
}

/** Captures output: codesign and spctl name the signing identity, so it is parsed, never printed. */
function runCaptured(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`\`${command} ${args[0]}\` exited with code ${String(result.status)}.`);
  }
  return `${result.stdout}${result.stderr}`;
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

const buildInfo = resolveBuildInfo({ signed: true });
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

const built = buildMacApp({ buildInfo, signing });

console.log("\nNotarizing the DMG…");
notarizeAndStapleDmg({ dmgPath: built.dmgPath, signing, run: runStreamed });

console.log("\nVerifying the artifact a clean machine will see…");
for (const check of verifySignedRelease({
  appPath: built.appPath,
  dmgPath: built.dmgPath,
  teamId: resolved.signing.teamId,
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
