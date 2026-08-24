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

const APP_ID = "com.otomat.desktop";

const PRODUCT_NAME = "Otomat";

const CHANNEL_ENV = "OTOMAT_CHANNEL";

/**
 * The channels a packaged build may declare, mirroring `PackagedChannel` in
 * `apps/desktop/src/shared/channel.ts`; the round-trip test in `tests/release/metadata.test.mjs`
 * keeps this writer and that reader from drifting.
 */
export const PACKAGED_CHANNELS = ["preview", "local", "stable"];

/**
 * `PR_NUMBER` as an integer, or null when unset. A malformed value fails the build instead of
 * silently producing an artifact that claims to be the stable app.
 */
export function readPrNumber(env) {
  const raw = (env.PR_NUMBER ?? "").trim();
  if (raw === "") return null;
  if (!/^[1-9][0-9]{0,6}$/.test(raw)) {
    throw new Error(`PR_NUMBER must be a pull request number; got "${raw}".`);
  }
  return Number.parseInt(raw, 10);
}

/**
 * The channel this packaging run declares. `PR_NUMBER` means a PR preview; anything else
 * `pnpm desktop:package` builds is the ad-hoc `local` channel, whose data roots are stable across
 * commits. `stable` is never reached from here — `pnpm desktop:release` passes it explicitly, so no
 * environment variable can promote an unsigned build into the signed app's data.
 */
export function resolvePackagedChannel(env, pr) {
  const raw = (env[CHANNEL_ENV] ?? "").trim();
  if (raw !== "" && !PACKAGED_CHANNELS.includes(raw)) {
    throw new Error(`${CHANNEL_ENV} must be one of ${PACKAGED_CHANNELS.join(", ")}; got "${raw}".`);
  }
  if (pr !== null) {
    if (raw === "" || raw === "preview") return "preview";
    throw new Error(`PR_NUMBER packages a preview, which ${CHANNEL_ENV}=${raw} contradicts.`);
  }
  if (raw === "preview") {
    throw new Error("A preview is named after its pull request; set PR_NUMBER to package one.");
  }
  return raw === "" ? "local" : raw;
}

/**
 * A distinct product name and bundle id per PR keeps the `.app` bundles apart; the `channel` and
 * `pr_number` shipped in build-info are what split userData, and with it Electron's
 * single-instance lock — see `resolveChannelDataRoot`.
 */
export function resolveBuildIdentity(pr) {
  if (pr === null) return { pr: null, productName: PRODUCT_NAME, appId: APP_ID };
  return {
    pr,
    productName: `${PRODUCT_NAME} PR ${String(pr)}`,
    appId: `${APP_ID}.pr${String(pr)}`,
  };
}

/** Assembling and signing a `.app` shells out to Apple's toolchain, which only macOS has. */
export function assertMacHost(platform) {
  if (platform === "darwin") return;
  throw new Error(
    `Packaging Otomat needs a macOS host; this one is ${platform}. ` +
      "Build it on a Mac, or let the macOS CI job produce the artifact.",
  );
}

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
 * The metadata shipped inside the app. The invariants the runtime parser enforces are checked here
 * too, so packaging can never emit a build the app would have to refuse.
 *
 * @param {{ version: string, commit: string, committedAt: string, arch: string,
 *   electronVersion: string, signed: boolean, channel: string, pr?: number | null }} input
 */
export function createBuildInfo(input) {
  const pr = input.pr ?? null;
  if (!PACKAGED_CHANNELS.includes(input.channel)) {
    throw new Error(`A build must declare a channel; got "${input.channel}".`);
  }
  if (input.channel === "stable" && !input.signed) {
    throw new Error(
      "A stable build must be Developer ID signed; `pnpm desktop:release` is the only way to produce one.",
    );
  }
  if ((input.channel === "preview") !== (pr !== null)) {
    throw new Error(`Channel ${input.channel} and PR_NUMBER ${String(pr)} disagree.`);
  }
  return {
    version: input.version,
    commit: input.commit,
    commit_short: input.commit.slice(0, 7),
    committed_at: input.committedAt,
    arch: input.arch,
    platform: "darwin",
    electron: input.electronVersion,
    signed: input.signed,
    pr_number: pr,
    channel: input.channel,
  };
}

export function sha256OfFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** electron-updater records base64 sha512 in `latest-mac.yml`; the check must speak the same digest. */
export function sha512OfFile(path) {
  return createHash("sha512").update(readFileSync(path)).digest("base64");
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
    product: PRODUCT_NAME,
    app_id: APP_ID,
    build: input.buildInfo,
    notarized: input.notarized,
    artifacts: input.artifacts,
  };
}
