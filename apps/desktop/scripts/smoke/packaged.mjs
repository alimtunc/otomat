// Install / launch / shutdown smoke for the packaged macOS artifact, ad-hoc or signed alike.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

import { RELEASE_OUT } from "../mac-build.mjs";
import { PACKAGED_CHANNELS, readPrNumber, resolveBuildIdentity } from "../release/metadata.mjs";
import { UPDATE_FEED_FILE } from "../release/update-feed.mjs";
import {
  capture,
  childPids,
  cleanup,
  installFromDmg,
  isolatedEnv,
  survivingPids,
  tail,
  temporaryDir,
  terminate,
  until,
} from "./harness.mjs";

// The same `PR_NUMBER` the packaging step read: the smoke installs and launches the artifact
// under the name that build actually carries.
const PR_NUMBER = readPrNumber(process.env);
const { productName: PRODUCT_NAME, appId: APP_ID } = resolveBuildIdentity(PR_NUMBER);

/** `lipo` names architectures the Mach-O way; `process.arch` uses Node's. */
const MACH_O_ARCH = { arm64: "arm64", x64: "x86_64" };

const DAEMON_PORT = 43_191;
const HEALTH_TIMEOUT_MS = 45_000;
const LAUNCH_TIMEOUT_MS = 90_000;

/**
 * The metadata the artifact carries: the channel decides which data roots and which remote
 * deployment the app will open, so a build that drifted from its intent must fail here rather than
 * in a user's profile. `OTOMAT_CHANNEL` states the intent when a caller has one — CI does, per
 * event; `pnpm desktop:release` names its channel in the artifact itself.
 */
function assertBuildMetadata() {
  const path = join(RELEASE_OUT, "build-info.json");
  if (!existsSync(path)) {
    throw new Error(`no build-info.json in ${RELEASE_OUT}. Run \`pnpm desktop:package\` first.`);
  }
  const info = JSON.parse(readFileSync(path, "utf8"));
  if (!PACKAGED_CHANNELS.includes(info.channel)) {
    throw new Error(`the artifact declares no channel: ${String(info.channel)}.`);
  }
  const expected = (process.env.OTOMAT_CHANNEL ?? "").trim();
  if (expected !== "" && info.channel !== expected) {
    throw new Error(`the artifact declares channel ${String(info.channel)}, not ${expected}.`);
  }
  if (info.channel === "stable" && info.signed !== true) {
    throw new Error("the artifact claims the stable channel without a signature.");
  }
  if ((info.pr_number ?? null) !== PR_NUMBER) {
    throw new Error(`the artifact names PR ${String(info.pr_number)}, not ${String(PR_NUMBER)}.`);
  }
  if (typeof info.commit_short !== "string" || info.commit_short.length !== 7) {
    throw new Error(`the artifact does not name its commit: ${String(info.commit_short)}.`);
  }
  return info;
}

/** Only the signed stable build ships `app-update.yml`, so nothing else can follow the stable feed. */
function assertUpdateWiring(appPath, buildInfo) {
  const inApp = join(appPath, "Contents", "Resources", "app-update.yml");
  const signed = buildInfo.channel === "stable";
  if (existsSync(inApp) !== signed) {
    throw new Error(
      signed
        ? `the signed build ships no app-update.yml at ${inApp}; it could never update itself.`
        : `a ${String(buildInfo.channel)} build must not ship app-update.yml, yet ${inApp} exists.`,
    );
  }
  const feed = join(RELEASE_OUT, UPDATE_FEED_FILE);
  if (signed && !existsSync(feed)) {
    throw new Error(`the signed build published no ${UPDATE_FEED_FILE} beside its artifacts.`);
  }
  return signed ? "follows the stable feed" : "offers a manual download only";
}

function locateDmg() {
  const candidates = readdirSync(RELEASE_OUT).filter((entry) => entry.endsWith(".dmg"));
  if (candidates.length !== 1) {
    throw new Error(
      `expected exactly one DMG in ${RELEASE_OUT}, found ${String(candidates.length)}. Run \`pnpm desktop:package\` first.`,
    );
  }
  return join(RELEASE_OUT, candidates[0]);
}

/** A listener left by an earlier run would answer the health poll and turn the gate green. */
function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(new Error(`something already listens on 127.0.0.1:${String(port)}; stop it first.`)),
    );
    probe.once("listening", () => probe.close(() => resolve()));
    probe.listen(port, "127.0.0.1");
  });
}

function assertBundleLayout(appPath) {
  const plist = JSON.parse(
    capture("plutil", ["-convert", "json", "-o", "-", join(appPath, "Contents", "Info.plist")]),
  );
  if (plist.CFBundleIdentifier !== APP_ID) {
    throw new Error(`installed bundle identifier is ${String(plist.CFBundleIdentifier)}.`);
  }
  if (plist.CFBundleName !== PRODUCT_NAME) {
    throw new Error(`installed bundle name is ${String(plist.CFBundleName)}.`);
  }

  const resources = join(appPath, "Contents", "Resources");
  const daemonDir = join(resources, "app.asar.unpacked", "daemon");
  for (const [label, path] of [
    ["renderer", join(resources, "web", "index.html")],
    ["daemon entry", join(daemonDir, "dist", "index.js")],
    ["app icon", join(resources, "icon.icns")],
  ]) {
    if (!existsSync(path)) throw new Error(`the installed app is missing its ${label} at ${path}.`);
  }

  // The prebuilt N-API binary better-sqlite3 resolves first, and the only one prepare-daemon keeps.
  const binding = join(
    daemonDir,
    `node_modules/better-sqlite3/prebuilds/darwin-${process.arch}.node`,
  );
  if (!existsSync(binding))
    throw new Error(`the installed app ships no SQLite binding at ${binding}.`);
  const expected = MACH_O_ARCH[process.arch];
  if (capture("lipo", ["-archs", binding]).trim() !== expected) {
    throw new Error(`the shipped SQLite binding is not a ${expected} Mach-O object.`);
  }

  capture("codesign", ["--verify", "--deep", "--strict", appPath]);
  return `${String(plist.CFBundleShortVersionString)} (${String(plist.CFBundleVersion)})`;
}

/** The daemon the installed app owns, booted through the app's own Electron binary as Node. */
async function smokeDaemon(appPath, expectedBuild) {
  const dataDir = temporaryDir("otomat-daemon-");
  const entry = join(appPath, "Contents/Resources/app.asar.unpacked/daemon/dist/index.js");
  const child = spawn(join(appPath, "Contents", "MacOS", PRODUCT_NAME), [entry], {
    env: isolatedEnv({
      ELECTRON_RUN_AS_NODE: "1",
      OTOMAT_DAEMON_HOST: "127.0.0.1",
      OTOMAT_DAEMON_PORT: String(DAEMON_PORT),
      OTOMAT_DB_PATH: join(dataDir, "otomat.db"),
      OTOMAT_PROJECT_ROOT: dataDir,
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  try {
    const health = await until("the packaged daemon", HEALTH_TIMEOUT_MS, async () => {
      if (child.exitCode !== null) throw new Error("the packaged daemon exited early.");
      const response = await fetch(`http://127.0.0.1:${DAEMON_PORT}/api/health`).catch(() => null);
      return response?.ok === true ? await response.json() : null;
    });
    if (health.status !== "ok")
      throw new Error(`unexpected health body: ${JSON.stringify(health)}`);
    // The shipped daemon must be the commit the app claims, or the app would call its own host stale.
    if (health.build !== expectedBuild) {
      throw new Error(`the packaged daemon reports build ${String(health.build)}.`);
    }
  } catch (error) {
    child.kill("SIGKILL");
    throw new Error(`${error.message}\n${output}`, { cause: error });
  }

  const exit = await terminate(child, "the packaged daemon", () => `  output:\n${tail(output)}`);
  if (exit.code !== 0 && exit.signal !== "SIGTERM") {
    throw new Error(`the packaged daemon exited with code ${String(exit.code)}:\n${output}`);
  }
  if (!existsSync(join(dataDir, "otomat.db"))) {
    throw new Error("the packaged daemon never created its database.");
  }
}

function launchEvidence(userData, output) {
  const read = (name) => {
    const path = join(userData, "logs", name);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  };
  return [
    `  output:\n${tail(output)}`,
    `  desktop.log:\n${tail(read("desktop.log"))}`,
    `  daemon.log:\n${tail(read("daemon.log"))}`,
  ].join("\n");
}

/** The whole shell: launch the installed app, let it own its daemon, quit it, reap the child. */
async function smokeApp(appPath) {
  const userData = temporaryDir("otomat-userdata-");
  const child = spawn(
    join(appPath, "Contents", "MacOS", PRODUCT_NAME),
    [`--user-data-dir=${userData}`],
    { env: isolatedEnv({}), stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  try {
    await until("the launched app", LAUNCH_TIMEOUT_MS, async () => {
      if (child.exitCode !== null) throw new Error("the app exited during launch.");
      return existsSync(join(userData, "otomat.db")) ? true : null;
    });
  } catch (error) {
    child.kill("SIGKILL");
    throw new Error(`${error.message}\n${output}`, { cause: error });
  }

  const spawnedPids = childPids(child.pid);
  await terminate(child, "the launched app", () => launchEvidence(userData, output));
  const orphans = await survivingPids(spawnedPids);
  if (orphans.length > 0) {
    for (const pid of orphans) spawnSync("kill", ["-9", pid]);
    throw new Error(`quitting the app left ${String(orphans.length)} child process(es) running.`);
  }
}

try {
  await assertPortFree(DAEMON_PORT);
  const buildInfo = assertBuildMetadata();
  console.log(`  ok — ${buildInfo.channel} build ${buildInfo.commit_short}`);
  const dmgPath = locateDmg();
  console.log(`Installing ${dmgPath}…`);
  const appPath = installFromDmg(dmgPath, PRODUCT_NAME);
  console.log(`  ok — installed ${PRODUCT_NAME}.app version ${assertBundleLayout(appPath)}`);
  console.log(`  ok — ${assertUpdateWiring(appPath, buildInfo)}`);
  await smokeDaemon(appPath, buildInfo.commit_short);
  console.log("  ok — the installed daemon boots, serves /api/health and stops on SIGTERM");
  await smokeApp(appPath);
  console.log(
    "  ok — the installed app launches, owns its daemon and leaves nothing behind on quit",
  );
  console.log("\nPackaged smoke passed.");
} catch (error) {
  console.error(`\nPackaged smoke FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
}
