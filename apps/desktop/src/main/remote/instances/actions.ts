import type {
  ExecutionHostOperationResult,
  RemoteInstanceEntry,
  RemoteInstanceListResult,
} from "@otomat/domain";

import {
  instanceDeployment,
  keepsDataAcrossBuilds,
  stopDaemonScript,
  type RemoteDeployment,
} from "../bootstrap/scripts.js";
import { scriptFailure, trimDetail } from "../bootstrap/status.js";
import { deployBundle } from "../deploy.js";
import type { RemoteSessionHandle } from "../session.js";
import { runSshScript, type SshScriptResult } from "../ssh/script.js";
import { upgradeRemoteDaemon } from "../upgrade/daemon.js";
import { deleteInstanceScript, listInstancesScript, parseInstanceList } from "./scripts.js";

const SCRIPT_TIMEOUT_MS = 30_000;
const INSTANCE_KEY = /^([0-9a-f]{7}|unknown)$/;

const INVALID_KEY: ExecutionHostOperationResult = {
  ok: false,
  message: "Unknown instance identifier.",
};

// Stopping or deleting the deployment this very app is attached to would strand its session
// as "connected" on a dead daemon, then let the retry loop resurrect what was just removed.
const OWN_INSTANCE: ExecutionHostOperationResult = {
  ok: false,
  message: "This build's own instance; quit this preview app or manage it from the stable install.",
};

export interface RemoteInstanceActionsOptions {
  alias(): string | null;
  /**
   * The deployment this app itself targets; `updateDaemon` installs here, and whether that
   * deployment keeps its data decides between an upgrade and a plain replacement.
   */
  deployment: RemoteDeployment;
  expectedBuild: string | null;
  /** GitHub `owner/repo` whose CI publishes the daemon bundles. */
  repo: string;
  /** The live remote session, when there is one; an upgrade needs it to check idleness and health. */
  session(): RemoteSessionHandle | null;
  log(message: string): void;
  runScript?: typeof runSshScript;
  fetchImpl?: typeof fetch;
}

/**
 * Instance housekeeping over one-shot SSH scripts: list, stop and delete the preview daemons
 * under `~/.otomat/instances`, and install the CI bundle for this app's own build. Every entry is
 * explicit — nothing here runs on a timer, and only the in-place upgrade of a deployment that keeps
 * its data ever restarts a daemon.
 */
export class RemoteInstanceActions {
  constructor(private readonly options: RemoteInstanceActionsOptions) {}

  async list(): Promise<RemoteInstanceListResult> {
    const alias = this.options.alias();
    if (alias === null) return { ok: false, message: "No remote host is configured." };
    try {
      const result = await this.run(alias, listInstancesScript(), SCRIPT_TIMEOUT_MS);
      if (result.code !== 0) return { ok: false, message: scriptFailure(result) };
      const rows = parseInstanceList(result.stdout);
      if (rows === null) return { ok: false, message: "The instance listing never completed." };
      const instances: RemoteInstanceEntry[] = [];
      for (const row of rows) {
        // A stray directory under instances/ is not stoppable or deletable; listing it would
        // offer actions that INSTANCE_KEY refuses forever.
        if (!INSTANCE_KEY.test(row.build)) {
          this.options.log(`Ignored a non-instance directory on the host: ${row.build}`);
          continue;
        }
        instances.push({
          build: row.build,
          running: row.running,
          size_kb: row.sizeKb,
          port: instanceDeployment(row.build).port,
        });
      }
      return { ok: true, instances };
    } catch (error) {
      return { ok: false, message: trimDetail(String(error)) };
    }
  }

  stop(build: unknown): Promise<ExecutionHostOperationResult> {
    if (typeof build !== "string" || !INSTANCE_KEY.test(build)) return Promise.resolve(INVALID_KEY);
    if (instanceDeployment(build).homeSuffix === this.options.deployment.homeSuffix) {
      return Promise.resolve(OWN_INSTANCE);
    }
    return this.operate(stopDaemonScript(instanceDeployment(build)), SCRIPT_TIMEOUT_MS);
  }

  remove(build: unknown): Promise<ExecutionHostOperationResult> {
    if (typeof build !== "string" || !INSTANCE_KEY.test(build)) return Promise.resolve(INVALID_KEY);
    if (instanceDeployment(build).homeSuffix === this.options.deployment.homeSuffix) {
      return Promise.resolve(OWN_INSTANCE);
    }
    return this.operate(deleteInstanceScript(build), SCRIPT_TIMEOUT_MS);
  }

  /**
   * Installs the CI bundle for the build this app expects into its own target. A deployment whose
   * data outlives its build upgrades in place — idle check, backup, swap, restart, health — while a
   * preview instance is only provisioned: nothing is started, and its next connect boots whatever
   * this left behind.
   */
  async updateDaemon(): Promise<ExecutionHostOperationResult> {
    const build = this.options.expectedBuild;
    if (build === null || !/^[0-9a-f]{7}$/.test(build)) {
      return { ok: false, message: "This build cannot name its own commit; deploy manually." };
    }
    const alias = this.options.alias();
    if (alias === null) return { ok: false, message: "No remote host is configured." };
    if (keepsDataAcrossBuilds(this.options.deployment)) return this.upgrade(alias, build);
    try {
      const deployed = await deployBundle({
        alias,
        deployment: this.options.deployment,
        build,
        repo: this.options.repo,
        runScript: this.runScript,
      });
      if (!deployed.ok) return { ok: false, message: `The deploy failed: ${deployed.reason}.` };
      this.options.log(`Deployed daemon build ${build} to ${this.options.deployment.homeSuffix}.`);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: trimDetail(String(error)) };
    }
  }

  private async upgrade(alias: string, build: string): Promise<ExecutionHostOperationResult> {
    const session = this.options.session();
    if (session === null) {
      return {
        ok: false,
        message: "The remote host is not connected yet. Try again once its tunnel is up.",
      };
    }
    return upgradeRemoteDaemon({
      alias,
      deployment: this.options.deployment,
      build,
      repo: this.options.repo,
      session,
      runScript: this.runScript,
      fetchImpl: this.options.fetchImpl ?? fetch,
      log: this.options.log,
    });
  }

  private async operate(script: string, timeoutMs: number): Promise<ExecutionHostOperationResult> {
    const alias = this.options.alias();
    if (alias === null) return { ok: false, message: "No remote host is configured." };
    try {
      const result = await this.run(alias, script, timeoutMs);
      if (result.code !== 0) return { ok: false, message: scriptFailure(result) };
      return { ok: true };
    } catch (error) {
      return { ok: false, message: trimDetail(String(error)) };
    }
  }

  private get runScript(): typeof runSshScript {
    return this.options.runScript ?? runSshScript;
  }

  private run(alias: string, script: string, timeoutMs: number): Promise<SshScriptResult> {
    return this.runScript({ alias, script, timeoutMs });
  }
}
