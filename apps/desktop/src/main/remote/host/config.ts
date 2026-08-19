import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { isExecutionHostId, type ExecutionHostId } from "@otomat/domain";

import { hasErrorCode } from "#shared/fs-errors";

const CONFIG_FILENAME = "execution-hosts.json";

/** Persisted host selection. Stores only the `~/.ssh/config` alias name — never credentials. */
export interface ExecutionHostsConfig {
  version: 1;
  remote: { ssh_alias: string } | null;
  active: ExecutionHostId;
}

export const DEFAULT_EXECUTION_HOSTS_CONFIG: ExecutionHostsConfig = {
  version: 1,
  remote: null,
  active: "local",
};

function isExecutionHostsConfig(value: unknown): value is ExecutionHostsConfig {
  if (typeof value !== "object" || value === null) return false;
  if (!("version" in value) || value.version !== 1) return false;
  if (!("active" in value) || !isExecutionHostId(value.active)) return false;
  if (!("remote" in value)) return false;
  const remote = value.remote;
  if (remote === null) return value.active === "local";
  if (typeof remote !== "object") return false;
  return (
    "ssh_alias" in remote && typeof remote.ssh_alias === "string" && remote.ssh_alias.length > 0
  );
}

export function executionHostsConfigPath(dataDir: string): string {
  return join(dataDir, CONFIG_FILENAME);
}

/** Missing file yields the default; unreadable or invalid content throws so the caller can log honestly. */
export function readExecutionHostsConfig(dataDir: string): ExecutionHostsConfig {
  let text: string;
  try {
    text = readFileSync(executionHostsConfigPath(dataDir), "utf8");
  } catch (error) {
    if (hasErrorCode(error) && error.code === "ENOENT") return DEFAULT_EXECUTION_HOSTS_CONFIG;
    throw error;
  }
  const parsed: unknown = JSON.parse(text);
  if (!isExecutionHostsConfig(parsed)) {
    throw new Error(`Invalid execution-hosts config at ${executionHostsConfigPath(dataDir)}`);
  }
  return parsed;
}

export function writeExecutionHostsConfig(dataDir: string, config: ExecutionHostsConfig): void {
  const path = executionHostsConfigPath(dataDir);
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, path);
}

/** Unreadable or invalid content falls back to the defaults, logged — boot never wedges on this file. */
export function readExecutionHostsConfigSafe(
  dataDir: string,
  log: (message: string) => void,
): ExecutionHostsConfig {
  try {
    return readExecutionHostsConfig(dataDir);
  } catch (error) {
    log(`Execution-hosts config unreadable, using defaults: ${String(error)}`);
    return DEFAULT_EXECUTION_HOSTS_CONFIG;
  }
}

export type ExecutionHostsConfigWriteResult = { ok: true } | { ok: false; message: string };

/** A failed write is logged and returned; the caller must not confirm a selection the disk never recorded. */
export function writeExecutionHostsConfigSafe(
  dataDir: string,
  config: ExecutionHostsConfig,
  log: (message: string) => void,
): ExecutionHostsConfigWriteResult {
  try {
    writeExecutionHostsConfig(dataDir, config);
    return { ok: true };
  } catch (error) {
    log(`Could not persist the execution-hosts config: ${String(error)}`);
    return { ok: false, message: "The host selection could not be saved to disk." };
  }
}
