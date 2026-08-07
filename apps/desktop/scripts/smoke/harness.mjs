// Shared machinery for the packaged smokes: scratch directories, DMG installation, and the
// process handling that proves a launched app leaves nothing behind.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SHUTDOWN_TIMEOUT_MS = 20_000;
const ORPHAN_GRACE_MS = 3_000;

const temporaries = [];
let mountPoint = null;

export function temporaryDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporaries.push(dir);
  return dir;
}

export function capture(command, args) {
  return execFileSync(command, args, { encoding: "utf8" });
}

export async function until(description, timeoutMs, satisfied) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const outcome = await satisfied();
    if (outcome !== null) return outcome;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${description} did not happen within ${timeoutMs}ms.`);
}

/** Installs the app the way a user does: mount, copy out with ditto (signatures survive), eject. */
export function installFromDmg(dmgPath, productName) {
  mountPoint = temporaryDir("otomat-dmg-");
  capture("hdiutil", ["attach", dmgPath, "-nobrowse", "-readonly", "-mountpoint", mountPoint]);
  const applications = temporaryDir("otomat-apps-");
  const installed = join(applications, `${productName}.app`);
  capture("ditto", [join(mountPoint, `${productName}.app`), installed]);
  capture("hdiutil", ["detach", mountPoint]);
  mountPoint = null;
  return installed;
}

/** A child environment that cannot reach the developer's own Otomat state or credentials. */
export function isolatedEnv(overrides) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("OTOMAT_") && overrides[key] === undefined) delete env[key];
  }
  if (overrides.ELECTRON_RUN_AS_NODE === undefined) delete env.ELECTRON_RUN_AS_NODE;
  return { ...env, ...overrides };
}

export function childPids(pid) {
  const result = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function alive(pid) {
  return spawnSync("kill", ["-0", pid]).status === 0;
}

export async function awaitExit(child, label) {
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

/** Electron's own helpers are children too, so a survivor needs a grace period before it is one. */
export async function survivingPids(pids) {
  const deadline = Date.now() + ORPHAN_GRACE_MS;
  let surviving = pids.filter(alive);
  while (surviving.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    surviving = surviving.filter(alive);
  }
  return surviving;
}

export function cleanup() {
  if (mountPoint !== null) spawnSync("hdiutil", ["detach", mountPoint, "-force"]);
  for (const dir of temporaries) rmSync(dir, { recursive: true, force: true });
  temporaries.length = 0;
}
