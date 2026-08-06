import type {
  ExecutionHostOperationResult,
  RemoteInstanceEntry,
  RemoteInstanceListResult,
} from "@otomat/domain";

import {
  instanceDeployment,
  stopDaemonScript,
  type RemoteDeployment,
} from "../bootstrap/scripts.js";
import { scriptFailure, trimDetail } from "../bootstrap/status.js";
import { runSshScript, type SshScriptResult } from "../ssh/script.js";
import {
  deleteInstanceScript,
  deployDaemonScript,
  listInstancesScript,
  parseDeployOutput,
  parseInstanceList,
} from "./scripts.js";

const SCRIPT_TIMEOUT_MS = 30_000;
// The artifact download does real network work on the host; give it room.
const DEPLOY_TIMEOUT_MS = 180_000;
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
  /** The deployment this app itself targets; `updateDaemon` deploys here. */
  deployment: RemoteDeployment;
  expectedBuild: string | null;
  /** GitHub `owner/repo` whose CI publishes the daemon bundles. */
  repo: string;
  log(message: string): void;
  runScript?: typeof runSshScript;
}

/**
 * Instance housekeeping over one-shot SSH scripts: list, stop and delete the preview daemons
 * under `~/.otomat/instances`, and deploy the CI bundle for this app's own build. Every entry
 * is explicit — nothing here runs on a timer, and nothing ever starts a daemon.
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

  /** Deploys the CI bundle for the build this app expects into its own target; nothing is started. */
  async updateDaemon(): Promise<ExecutionHostOperationResult> {
    const build = this.options.expectedBuild;
    if (build === null || !/^[0-9a-f]{7}$/.test(build)) {
      return { ok: false, message: "This build cannot name its own commit; deploy manually." };
    }
    const alias = this.options.alias();
    if (alias === null) return { ok: false, message: "No remote host is configured." };
    try {
      const script = deployDaemonScript({
        deployment: this.options.deployment,
        build,
        repo: this.options.repo,
      });
      const result = await this.run(alias, script, DEPLOY_TIMEOUT_MS);
      if (result.code !== 0) return { ok: false, message: scriptFailure(result) };
      const outcome = parseDeployOutput(result.stdout);
      if (outcome === null) return { ok: false, message: "The deploy script reported nothing." };
      if (outcome.kind !== "deployed")
        return { ok: false, message: describeDeployFailure(outcome) };
      this.options.log(`Deployed daemon build ${build} to ${this.options.deployment.homeSuffix}.`);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: trimDetail(String(error)) };
    }
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

  private run(alias: string, script: string, timeoutMs: number): Promise<SshScriptResult> {
    return (this.options.runScript ?? runSshScript)({ alias, script, timeoutMs });
  }
}

function describeDeployFailure(
  outcome: Exclude<ReturnType<typeof parseDeployOutput>, null | { kind: "deployed" }>,
): string {
  switch (outcome.kind) {
    case "gh_missing":
      return "The host has no `gh` CLI; install and authenticate it to deploy from CI artifacts.";
    case "artifact_not_found":
      return `No CI artifact named ${outcome.name} (artifacts expire after 7 days; re-run the workflow to rebuild it).`;
    case "download_failed":
      return `The artifact download failed on the host: ${outcome.detail}`;
    case "extract_failed":
      return `The artifact could not be extracted on the host: ${outcome.detail}`;
  }
}
