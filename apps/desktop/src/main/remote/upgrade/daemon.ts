import type { ExecutionHostOperationResult } from "@otomat/domain";

import { stopDaemonScript, type RemoteDeployment } from "../bootstrap/scripts.js";
import { scriptFailure, trimDetail } from "../bootstrap/status.js";
import { deployBundle } from "../deploy.js";
import { remoteIsIdle } from "../idle.js";
import type { RemoteSessionHandle } from "../session.js";
import type { runSshScript } from "../ssh/script.js";
import {
  backupDatabaseScript,
  daemonPresenceScript,
  parseBackupOutput,
  parseDaemonPresence,
  parseRollbackOutput,
  rollbackDaemonScript,
} from "./scripts.js";

const SCRIPT_TIMEOUT_MS = 60_000;

export interface RemoteDaemonUpgradeOptions {
  alias: string;
  /** The deployment this app targets; its data root is kept, only the daemon bundle changes. */
  deployment: RemoteDeployment;
  /** sha7 of the build to install; the caller has validated its shape. */
  build: string;
  /** GitHub `owner/repo` whose CI publishes the daemon bundles. */
  repo: string;
  session: RemoteSessionHandle;
  runScript: typeof runSshScript;
  fetchImpl: typeof fetch;
  log(message: string): void;
}

/**
 * Upgrades the daemon of a deployment whose database has to survive the upgrade — the ones
 * `keepsDataAcrossBuilds` names: idle check, stop, durable database backup, atomic bundle swap,
 * restart, and a health response that names the expected build before it counts as done. The new
 * daemon migrates the database it finds at boot under the usual data-safety policy (pre-migration
 * backup, refusal rather than a partial schema), so a migration that fails shows up here as a
 * daemon that never answers — and takes the same rollback as any other failure to boot.
 *
 * Every failure leaves a running daemon and names the backup: the previous bundle goes back and the
 * session reconnects to it.
 */
export async function upgradeRemoteDaemon(
  options: RemoteDaemonUpgradeOptions,
): Promise<ExecutionHostOperationResult> {
  const url = options.session.url;
  if (options.session.status.phase !== "connected" || url === null) {
    return firstInstall(options);
  }
  if (!(await remoteIsIdle({ baseUrl: url, fetchImpl: options.fetchImpl, log: options.log }))) {
    return {
      ok: false,
      message:
        "The remote daemon is busy or did not answer. Wait for its runs to settle, then update again.",
    };
  }
  try {
    return await swapBundle(options);
  } catch (error) {
    const phase = await reconnect(options);
    return {
      ok: false,
      message: `The update failed: ${trimDetail(String(error))}. The daemon is ${phase}.`,
    };
  }
}

/**
 * A deployment with no daemon in it has nothing to stop, no run to cut and no daemon that could be
 * mid-write: its first install is the same plain deploy a preview instance gets. Anything else —
 * including a host that cannot say — needs a live daemon before it may be touched.
 */
async function firstInstall(
  options: RemoteDaemonUpgradeOptions,
): Promise<ExecutionHostOperationResult> {
  try {
    const probe = await options.runScript({
      alias: options.alias,
      script: daemonPresenceScript(options.deployment),
      timeoutMs: SCRIPT_TIMEOUT_MS,
    });
    const presence = probe.code === 0 ? parseDaemonPresence(probe.stdout) : null;
    if (presence !== "absent") {
      return {
        ok: false,
        message:
          "Connect to the host first: without its daemon answering, Otomat cannot tell whether a run is in flight.",
      };
    }
    const deployed = await deployBundle(options);
    if (!deployed.ok) return { ok: false, message: `The install failed: ${deployed.reason}.` };
    options.log(`Installed daemon build ${options.build} at ${options.deployment.homeSuffix}.`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: trimDetail(String(error)) };
  }
}

/** Runs from a stopped daemon onwards; every exit path restarts one. */
async function swapBundle(
  options: RemoteDaemonUpgradeOptions,
): Promise<ExecutionHostOperationResult> {
  const stopped = await options.runScript({
    alias: options.alias,
    script: `${stopDaemonScript(options.deployment)}${backupDatabaseScript(options.deployment)}`,
    timeoutMs: SCRIPT_TIMEOUT_MS,
  });
  if (stopped.code !== 0) return restart(options, scriptFailure(stopped));
  const backup = parseBackupOutput(stopped.stdout);
  if (backup === null) {
    return restart(options, "the backup step reported nothing");
  }
  if (backup.kind === "failed") {
    return restart(options, `the database could not be backed up: ${backup.detail}`);
  }
  const backupPath = backup.kind === "backed_up" ? backup.path : null;

  const deployed = await deployBundle(options);
  if (!deployed.ok) return restart(options, deployed.reason);

  const status = await options.session.refreshDaemon();
  if (status.phase !== "connected") {
    return rollBack(options, "the upgraded daemon did not come back up", backupPath);
  }
  const running = options.session.remoteBuild;
  if (running !== options.build) {
    return rollBack(
      options,
      `the restarted daemon reports build ${running ?? "none"}, not ${options.build}`,
      backupPath,
    );
  }
  options.log(`Upgraded ${options.deployment.homeSuffix} to daemon build ${options.build}.`);
  return { ok: true };
}

/** Brings the current bundle back up after a failure that never touched it. */
async function restart(
  options: RemoteDaemonUpgradeOptions,
  reason: string,
): Promise<ExecutionHostOperationResult> {
  const phase = await reconnect(options);
  return {
    ok: false,
    message: `The update stopped: ${reason}. Its data is untouched and the daemon is ${phase}.`,
  };
}

/** Puts the previous bundle back and restarts it; the backup stays for a manual restore. */
async function rollBack(
  options: RemoteDaemonUpgradeOptions,
  reason: string,
  backupPath: string | null,
): Promise<ExecutionHostOperationResult> {
  options.log(`Rolling the remote daemon back: ${reason}.`);
  const result = await options.runScript({
    alias: options.alias,
    script: rollbackDaemonScript(options.deployment),
    timeoutMs: SCRIPT_TIMEOUT_MS,
  });
  const outcome = result.code === 0 ? parseRollbackOutput(result.stdout) : null;
  const phase = await reconnect(options);
  const recovery =
    outcome?.kind === "restored"
      ? `The previous daemon is back and ${phase}.`
      : "The previous daemon could not be put back; deploy a known-good build from this panel.";
  const database =
    backupPath === null
      ? "The database was left in place."
      : `The database backup taken before the update is at ${backupPath}.`;
  return { ok: false, message: `The update failed: ${reason}. ${recovery} ${database}` };
}

/** The reported phase, never a throw: the composed failure must reach the user whatever ssh did. */
async function reconnect(options: RemoteDaemonUpgradeOptions): Promise<string> {
  try {
    return (await options.session.refreshDaemon()).phase;
  } catch (error) {
    options.log(`Remote daemon restart failed after a stopped update: ${String(error)}`);
    return "unreachable";
  }
}
