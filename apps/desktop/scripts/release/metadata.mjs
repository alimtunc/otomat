// Build metadata that ties a downloadable artifact to a commit and a version: the `build-info.json`
// shipped inside the app, and the manifest published next to the DMG.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

/**
 * Alpha architecture policy: one artifact per architecture, each built on a host of that
 * architecture. Packaging keeps the build host's better-sqlite3 binary and the pipeline never
 * cross-compiles, so an architecture is releasable only from its own runner.
 */
export const SUPPORTED_RELEASE_ARCHS = ["arm64"];

export const APP_ID = "com.otomat.desktop";

export function assertReleasableArch(arch) {
  if (SUPPORTED_RELEASE_ARCHS.includes(arch)) return;
  throw new Error(
    `The macOS alpha ships ${SUPPORTED_RELEASE_ARCHS.join(", ")} only; this host is ${arch}. ` +
      "Release from a matching runner, or extend SUPPORTED_RELEASE_ARCHS together with a runner for it.",
  );
}

/** A tagged run must carry the version it claims: `v<version>` and package.json cannot disagree. */
export function assertTagMatchesVersion(ref, version) {
  if (typeof ref !== "string" || !ref.startsWith("refs/tags/")) return;
  const tag = ref.slice("refs/tags/".length);
  if (tag === `v${version}`) return;
  throw new Error(
    `Tag ${tag} does not match the packaged version ${version}. ` +
      `Tag the release v${version}, or bump apps/desktop/package.json to match the tag.`,
  );
}

export function readProductVersion(packageJsonPath) {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`${packageJsonPath} has no version to release.`);
  }
  return parsed.version;
}

/**
 * @param {{ version: string, commit: string, committedAt: string, arch: string,
 *   electronVersion: string, signed: boolean }} input
 */
export function createBuildInfo(input) {
  return {
    version: input.version,
    commit: input.commit,
    commit_short: input.commit.slice(0, 7),
    committed_at: input.committedAt,
    arch: input.arch,
    platform: "darwin",
    electron: input.electronVersion,
    signed: input.signed,
  };
}

export function sha256OfFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function describeArtifact(path) {
  return { name: basename(path), bytes: statSync(path).size, sha256: sha256OfFile(path) };
}

/**
 * @param {{ buildInfo: ReturnType<typeof createBuildInfo>, notarized: boolean,
 *   artifacts: ReturnType<typeof describeArtifact>[] }} input
 */
export function createArtifactManifest(input) {
  return {
    product: "Otomat",
    app_id: APP_ID,
    build: input.buildInfo,
    notarized: input.notarized,
    artifacts: input.artifacts,
  };
}
