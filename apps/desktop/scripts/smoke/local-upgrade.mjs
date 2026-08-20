// The `local` channel's promise, end to end: two ad-hoc packages built from two different commits
// open the same profile. It installs the artifact `pnpm desktop:package` just produced, launches
// it against a scratch appData, packages the next commit, launches that one the same way, and
// checks the database it finds is the very same file — not a new one beside it.
//
// The remote half of the promise (one `~/.otomat/local` deployment across commits) has no host in
// CI; `deploymentForChannel` covers it in tests/remote/bootstrap/scripts.test.ts.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { DESKTOP, RELEASE_OUT, REPO } from "../mac-build.mjs";
import { assertMacHost } from "../release/metadata.mjs";
import {
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

const PRODUCT_NAME = "Otomat";
// Mirrors `APP_DATA_ROOT_ENV` in src/shared/constants.ts, which a plain node script cannot import.
// Drift shows up as a launch that never reaches its daemon, never as a silently skipped check.
const APP_DATA_ENV = "OTOMAT_DESKTOP_APP_DATA";
const LAUNCH_TIMEOUT_MS = 120_000;
const BOOT_MARKER = "listening on http";

function git(args) {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
}

/** The channel and commit of the artifact currently in `release/`, plus its DMG. */
function currentArtifact() {
  const info = JSON.parse(readFileSync(join(RELEASE_OUT, "build-info.json"), "utf8"));
  if (info.channel !== "local") {
    throw new Error(
      `this smoke needs a local package; release/ holds a ${String(info.channel)} build. ` +
        "Run `pnpm desktop:package` with no PR_NUMBER first.",
    );
  }
  const dmgs = readdirSync(RELEASE_OUT).filter((entry) => entry.endsWith(".dmg"));
  if (dmgs.length !== 1) {
    throw new Error(`expected exactly one DMG in ${RELEASE_OUT}, found ${String(dmgs.length)}.`);
  }
  return { info, dmgPath: join(RELEASE_OUT, dmgs[0]) };
}

/** The single directory the app created under the scratch appData; null until it exists. */
function channelRoot(appData) {
  const entries = readdirSync(appData).filter((entry) =>
    statSync(join(appData, entry)).isDirectory(),
  );
  if (entries.length > 1) {
    throw new Error(`the app created ${String(entries.length)} data roots: ${entries.join(", ")}.`);
  }
  return entries.length === 0 ? null : join(appData, entries[0]);
}

function logContents(appData, name) {
  const root = channelRoot(appData);
  if (root === null) return null;
  const log = join(root, "logs", name);
  return existsSync(log) ? { root, contents: readFileSync(log, "utf8") } : { root, contents: "" };
}

/** How much of a log this launch inherits, so only its own lines can answer for it. */
function logLength(appData, name) {
  return logContents(appData, name)?.contents.length ?? 0;
}

/** A boot line past `since` means this launch's own daemon is up, not the previous one's. */
function bootedAfter(appData, since) {
  const log = logContents(appData, "daemon.log");
  if (log === null) return null;
  return log.contents.slice(since).includes(BOOT_MARKER) ? log.root : null;
}

/** What a stuck quit leaves to read, sliced to this launch: the profile is shared across builds. */
function launchEvidence(appData, output, inherited) {
  const since = (name) => tail(logContents(appData, name)?.contents.slice(inherited[name]) ?? "");
  return [
    `  output:\n${tail(output)}`,
    `  desktop.log:\n${since("desktop.log")}`,
    `  daemon.log:\n${since("daemon.log")}`,
  ].join("\n");
}

/** Launches the installed app against the scratch appData, waits for its daemon, then quits it. */
async function runOnce(appPath, appData, label) {
  const inherited = {
    "daemon.log": logLength(appData, "daemon.log"),
    "desktop.log": logLength(appData, "desktop.log"),
  };
  const child = spawn(join(appPath, "Contents", "MacOS", PRODUCT_NAME), [], {
    env: isolatedEnv({ [APP_DATA_ENV]: appData }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  let root;
  try {
    root = await until(`${label} reaching its daemon`, LAUNCH_TIMEOUT_MS, async () => {
      if (child.exitCode !== null) throw new Error(`${label} exited during launch.`);
      return bootedAfter(appData, inherited["daemon.log"]);
    });
  } catch (error) {
    child.kill("SIGKILL");
    throw new Error(`${error.message}\n${output}`, { cause: error });
  }

  const spawnedPids = childPids(child.pid);
  await terminate(child, label, () => launchEvidence(appData, output, inherited));
  const orphans = await survivingPids(spawnedPids);
  for (const pid of orphans) spawnSync("kill", ["-9", pid]);
  if (orphans.length > 0) {
    throw new Error(`quitting ${label} left ${String(orphans.length)} child process(es) running.`);
  }
  return root;
}

/** What must be identical across builds: the same root, holding the same database file. */
function profileIdentity(root) {
  const db = join(root, "otomat.db");
  if (!existsSync(db)) throw new Error(`no database in ${root}.`);
  const manifest = JSON.parse(readFileSync(join(root, "data-layout.json"), "utf8"));
  const stats = statSync(db);
  return { root, inode: stats.ino, bytes: stats.size, createdAt: manifest.created_at };
}

/** The full packaged gate on whatever `release/` holds: bundle layout, health, and its build. */
function smokePackaged() {
  execFileSync(process.execPath, [join(DESKTOP, "scripts", "smoke", "packaged.mjs")], {
    cwd: REPO,
    stdio: "inherit",
    env: { ...process.env, PR_NUMBER: "", OTOMAT_CHANNEL: "" },
  });
}

/** Packages the next commit of this branch, then puts the branch back where it was. */
function packageNextCommit() {
  if (git(["status", "--porcelain"]) !== "") {
    throw new Error("the working tree must be clean: this smoke commits and resets the branch.");
  }
  const head = git(["rev-parse", "HEAD"]);
  git([
    "-c",
    "user.email=smoke@otomat.local",
    "-c",
    "user.name=Otomat Smoke",
    "commit",
    "--allow-empty",
    "-m",
    "smoke: package the local channel a second time",
  ]);
  try {
    execFileSync(process.execPath, [join(DESKTOP, "scripts", "package-mac.mjs")], {
      cwd: REPO,
      stdio: "inherit",
      env: { ...process.env, PR_NUMBER: "", OTOMAT_CHANNEL: "" },
    });
  } finally {
    git(["reset", "--hard", head]);
  }
}

try {
  assertMacHost(process.platform);
  const appData = temporaryDir("otomat-appdata-");

  const first = currentArtifact();
  console.log(`Installing local build ${first.info.commit_short}…`);
  const firstRoot = await runOnce(installFromDmg(first.dmgPath, PRODUCT_NAME), appData, "build N");
  const before = profileIdentity(firstRoot);
  console.log(`  ok — it created ${before.root} and its database`);

  console.log("\nPackaging the next commit…");
  packageNextCommit();
  const second = currentArtifact();
  if (second.info.commit_short === first.info.commit_short) {
    throw new Error("the second package names the same commit as the first.");
  }
  // Its own health and build-info gate, before it is asked to open the first build's profile.
  smokePackaged();

  console.log(`\nInstalling local build ${second.info.commit_short}…`);
  const secondRoot = await runOnce(
    installFromDmg(second.dmgPath, PRODUCT_NAME),
    appData,
    "build N+1",
  );
  const after = profileIdentity(secondRoot);

  if (after.root !== before.root) {
    throw new Error(`build N+1 opened ${after.root}, not ${before.root}.`);
  }
  if (after.inode !== before.inode) {
    throw new Error("build N+1 replaced the database file instead of opening it.");
  }
  if (after.createdAt !== before.createdAt) {
    throw new Error("build N+1 re-created the data layout instead of keeping it.");
  }
  if (after.bytes < before.bytes) {
    throw new Error("the database shrank across the upgrade.");
  }
  console.log("  ok — it reopened the same profile and the same database file");
  console.log("\nLocal channel upgrade smoke passed.");
} catch (error) {
  console.error(`\nLocal channel upgrade smoke FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
}
