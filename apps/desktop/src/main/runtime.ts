import { join } from "node:path";

import type { RemoteHostStatus } from "@otomat/domain";

import { DaemonController } from "./daemon.js";
import {
  prepareDataDirectory,
  RotatingLog,
  type ManagedDataDirectory,
} from "./data-safety/index.js";
import { LinearCoordinator } from "./linear-coordinator.js";
import { createMainLinearVault } from "./linear-vault-io.js";
import type { AppPaths } from "./paths.js";
import { ExecutionHostManager } from "./remote/manager.js";

const LOG_MAX_BYTES = 1024 * 1024;
const LOG_ARCHIVES = 3;

export interface DesktopRuntime {
  dataDirectory: ManagedDataDirectory;
  desktopLog: RotatingLog;
  daemonLog: RotatingLog;
  daemon: DaemonController;
  linear: LinearCoordinator;
  hosts: ExecutionHostManager;
}

interface DesktopRuntimeOptions {
  paths: AppPaths;
  userData: string;
  userPath: string;
  /** Build this app expects on every host (packaged commit or dev checkout HEAD); null when unidentifiable. */
  expectedBuild: string | null;
  localDaemonUrl(): string;
  onRemoteStatus(status: RemoteHostStatus): void;
  applyRendererUrl(url: string): void;
}

export function createDesktopRuntime(options: DesktopRuntimeOptions): DesktopRuntime {
  const dataDirectory = prepareDataDirectory(options.userData);
  const desktopLog = new RotatingLog(join(dataDirectory.logsDir, "desktop.log"), {
    maxBytes: LOG_MAX_BYTES,
    archives: LOG_ARCHIVES,
  });
  const daemonLog = new RotatingLog(join(dataDirectory.logsDir, "daemon.log"), {
    maxBytes: LOG_MAX_BYTES,
    archives: LOG_ARCHIVES,
  });
  // The vault is local state, so the key only ever reaches the local daemon — never a remote host over the tunnel (docs/ai/remote-execution-host.md, Known V1 limits).
  const linear = new LinearCoordinator(
    createMainLinearVault(dataDirectory.root),
    options.localDaemonUrl,
  );
  const daemon = new DaemonController({
    daemonEntry: options.paths.daemonEntry,
    dbPath: dataDirectory.dbPath,
    projectRoot: dataDirectory.root,
    userPath: options.userPath,
    packaged: options.paths.packaged,
    electronBinary: process.execPath,
    ...(options.expectedBuild === null ? {} : { buildSha: options.expectedBuild }),
    writeLog: (stream, text) => daemonLog.write(`[${stream}] ${text}`),
  });
  const hosts = new ExecutionHostManager({
    dataDir: dataDirectory.root,
    log: (message) => desktopLog.write(message),
    localDaemonUrl: options.localDaemonUrl,
    onRemoteStatus: options.onRemoteStatus,
    applyRendererUrl: options.applyRendererUrl,
    expectedBuild: options.expectedBuild,
  });
  return { dataDirectory, desktopLog, daemonLog, daemon, linear, hosts };
}
