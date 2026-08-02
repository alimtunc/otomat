import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ExecutionHostId } from "@otomat/domain";

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
  const config = value as Record<string, unknown>;
  if (config.version !== 1) return false;
  if (config.active !== "local" && config.active !== "remote") return false;
  if (config.remote === null) return config.active === "local";
  if (typeof config.remote !== "object") return false;
  const remote = config.remote as Record<string, unknown>;
  return typeof remote.ssh_alias === "string" && remote.ssh_alias.length > 0;
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

export function writeExecutionHostsConfigSafe(
  dataDir: string,
  config: ExecutionHostsConfig,
  log: (message: string) => void,
): void {
  try {
    writeExecutionHostsConfig(dataDir, config);
  } catch (error) {
    log(`Could not persist the execution-hosts config: ${String(error)}`);
  }
}
