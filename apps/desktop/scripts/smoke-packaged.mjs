// Install / launch / shutdown smoke for the packaged macOS artifact. It installs the app the way a
// user does — mount the DMG, copy the bundle out, eject — then proves the installed copy boots its
// own daemon (native module under Electron's ABI, migrations, health) and shuts it down cleanly.
// Works for both the ad-hoc local artifact and a signed release. Run after `pnpm desktop:package`.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PRODUCT_NAME, RELEASE_OUT } from "./mac-build.mjs";

const DAEMON_PORT = 43_191;
const HEALTH_TIMEOUT_MS = 45_000;
const LAUNCH_TIMEOUT_MS = 90_000;
const SHUTDOWN_TIMEOUT_MS = 20_000;

const temporaries = [];
let mountPoint = null;

function temporaryDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporaries.push(dir);
  return dir;
}

function capture(command, args) {
  return execFileSync(command, args, { encoding: "utf8" });
}

async function until(description, timeoutMs, satisfied) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const outcome = await satisfied();
    if (outcome !== null) return outcome;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${description} did not happen within ${timeoutMs}ms.`);
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

/** Installs the app the way a user does: mount, copy out with ditto (signatures survive), eject. */
function installFromDmg(dmgPath) {
  mountPoint = temporaryDir("otomat-dmg-");
  capture("hdiutil", ["attach", dmgPath, "-nobrowse", "-readonly", "-mountpoint", mountPoint]);
  const applications = temporaryDir("otomat-apps-");
  const installed = join(applications, `${PRODUCT_NAME}.app`);
  capture("ditto", [join(mountPoint, `${PRODUCT_NAME}.app`), installed]);
  capture("hdiutil", ["detach", mountPoint]);
  mountPoint = null;
  return installed;
}

function assertBundleLayout(appPath) {
  const plist = JSON.parse(
    capture("plutil", ["-convert", "json", "-o", "-", join(appPath, "Contents", "Info.plist")]),
  );
  if (plist.CFBundleIdentifier !== "com.otomat.desktop") {
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

  const binding = join(daemonDir, "node_modules/better-sqlite3/build/Release/better_sqlite3.node");
  if (!existsSync(binding))
    throw new Error(`the installed app ships no SQLite binding at ${binding}.`);
  if (!capture("file", [binding]).includes(process.arch)) {
    throw new Error(`the shipped SQLite binding is not a ${process.arch} Mach-O object.`);
  }

  capture("codesign", ["--verify", "--deep", "--strict", appPath]);
  return `${String(plist.CFBundleShortVersionString)} (${String(plist.CFBundleVersion)})`;
}

function childPids(pid) {
  const result = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function alive(pid) {
  return spawnSync("kill", ["-0", pid]).status === 0;
}

async function awaitExit(child, label) {
  const exited = new Promise((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  const timer = new Promise((resolve) => setTimeout(() => resolve(null), SHUTDOWN_TIMEOUT_MS));
  const outcome = await Promise.race([exited, timer]);
  if (outcome === null) {
    child.kill("SIGKILL");
    throw new Error(`${label} ignored SIGTERM for ${SHUTDOWN_TIMEOUT_MS}ms.`);
  }
  return outcome;
}

/** A child environment that cannot reach the developer's own Otomat state or credentials. */
function isolatedEnv(overrides) {
  const env = { ...process.env, ...overrides };
  delete env.OTOMAT_LINEAR_API_KEY;
  if (overrides.ELECTRON_RUN_AS_NODE === undefined) delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

/** The daemon the installed app owns, booted through the app's own Electron binary as Node. */
async function smokeDaemon(appPath) {
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
      if (child.exitCode !== null) {
        throw new Error(`the packaged daemon exited early:\n${output}`);
      }
      const response = await fetch(`http://127.0.0.1:${DAEMON_PORT}/api/health`).catch(() => null);
      return response?.ok === true ? await response.json() : null;
    });
    if (health.status !== "ok")
      throw new Error(`unexpected health body: ${JSON.stringify(health)}`);
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }

  child.kill("SIGTERM");
  const exit = await awaitExit(child, "the packaged daemon");
  if (exit.code !== 0 && exit.signal !== "SIGTERM") {
    throw new Error(`the packaged daemon exited with code ${String(exit.code)}:\n${output}`);
  }
  if (!existsSync(join(dataDir, "otomat.db"))) {
    throw new Error("the packaged daemon never created its database.");
  }
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
      if (child.exitCode !== null) throw new Error(`the app exited during launch:\n${output}`);
      return existsSync(join(userData, "otomat.db")) ? true : null;
    });
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }

  const daemonPids = childPids(child.pid);
  child.kill("SIGTERM");
  await awaitExit(child, "the launched app");
  const orphans = daemonPids.filter(alive);
  if (orphans.length > 0) {
    for (const pid of orphans) spawnSync("kill", ["-9", pid]);
    throw new Error(`quitting the app left ${String(orphans.length)} daemon process(es) running.`);
  }
}

function cleanup() {
  if (mountPoint !== null) spawnSync("hdiutil", ["detach", mountPoint, "-force"]);
  for (const dir of temporaries) rmSync(dir, { recursive: true, force: true });
}

try {
  const dmgPath = locateDmg();
  console.log(`Installing ${dmgPath}…`);
  const appPath = installFromDmg(dmgPath);
  console.log(`  ok — installed ${PRODUCT_NAME}.app version ${assertBundleLayout(appPath)}`);
  await smokeDaemon(appPath);
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
