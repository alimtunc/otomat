import { join } from "node:path";

import type { RemoteHostStatus } from "@otomat/domain";

import { OTOMAT_GITHUB_REPO } from "#shared/constants";

import { DaemonController } from "./daemon.js";
import {
  prepareDataDirectory,
  RotatingLog,
  type ManagedDataDirectory,
} from "./data-safety/index.js";
import { LinearCoordinator } from "./linear-coordinator.js";
import { createMainLinearVault } from "./linear-vault-io.js";
import type { AppPaths } from "./paths.js";
import { PreviewSandbox } from "./preview/sandbox.js";
import { instanceDeployment, STABLE_DEPLOYMENT } from "./remote/bootstrap/scripts.js";
import { RemoteInstanceActions } from "./remote/instances/actions.js";
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
  sandbox: PreviewSandbox;
  instances: RemoteInstanceActions;
}

interface DesktopRuntimeOptions {
  paths: AppPaths;
  userData: string;
  userPath: string;
  /** Build this app expects on every host (packaged commit or dev checkout HEAD); null when unidentifiable. */
  expectedBuild: string | null;
  /** True for a packaged preview build: the sandbox seeds at boot and can be reset. */
  preview: boolean;
  localDaemonUrl(): string;
  onRemoteStatus(status: RemoteHostStatus): void;
  applyRendererUrl(url: string): void;
  onSandboxDaemonStarted(url: string): void;
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
  // A preview targets its own isolated instance on the host; the stable app keeps ~/.otomat.
  const deployment = options.preview
    ? instanceDeployment(options.expectedBuild)
    : STABLE_DEPLOYMENT;
  const hosts = new ExecutionHostManager({
    dataDir: dataDirectory.root,
    log: (message) => desktopLog.write(message),
    localDaemonUrl: options.localDaemonUrl,
    onRemoteStatus: options.onRemoteStatus,
    applyRendererUrl: options.applyRendererUrl,
    expectedBuild: options.expectedBuild,
    deployment,
  });
  const sandbox = new PreviewSandbox({
    enabled: options.preview,
    dataDirectory,
    templateDir: options.paths.sandboxTemplateDir,
    daemon,
    onDaemonStarted: options.onSandboxDaemonStarted,
    log: (message) => desktopLog.write(message),
  });
  const instances = new RemoteInstanceActions({
    alias: () => hosts.remoteSshAlias,
    deployment,
    expectedBuild: options.expectedBuild,
    repo: OTOMAT_GITHUB_REPO,
    log: (message) => desktopLog.write(message),
  });
  return { dataDirectory, desktopLog, daemonLog, daemon, linear, hosts, sandbox, instances };
}
