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
import { deleteInstanceScript, listInstancesScript, parseInstanceList } from "./scripts.js";

const SCRIPT_TIMEOUT_MS = 30_000;
const INSTANCE_KEY = /^([0-9a-f]{7}|unknown)$/;

const INVALID_KEY: ExecutionHostOperationResult = {
  ok: false,
  message: "Unknown instance identifier.",
};

const OWN_INSTANCE: ExecutionHostOperationResult = {
  ok: false,
  message: "This build's own instance; quit this preview app or manage it from the stable install.",
};

export interface RemoteInstanceActionsOptions {
  alias(): string | null;
  /** The deployment this app itself targets, and therefore the one instance it must not touch. */
  deployment: RemoteDeployment;
  log(message: string): void;
  runScript?: typeof runSshScript;
}

/**
 * Instance housekeeping over one-shot SSH scripts: list, stop and delete the preview daemons under
 * `~/.otomat/instances`. Every entry is explicit and nothing here runs on a timer; installing a
 * build is the upgrade coordinator's job, on whichever deployment this app drives.
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
