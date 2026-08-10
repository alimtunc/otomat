import { join } from "node:path";

import type { LinearDeliverySnapshot, RemoteHostStatus } from "@otomat/domain";

import type { DesktopChannel } from "#shared/channel";
import { OTOMAT_GITHUB_REPO } from "#shared/constants";

import { DaemonController } from "./daemon.js";
import {
  prepareDataDirectory,
  RotatingLog,
  type ManagedDataDirectory,
} from "./data-safety/index.js";
import { LinearCoordinator } from "./linear/coordinator.js";
import { linearTargets } from "./linear/targets.js";
import { createMainLinearVault } from "./linear/vault-io.js";
import type { AppPaths } from "./paths.js";
import { PreviewSandbox } from "./preview/sandbox.js";
import { deploymentForChannel } from "./remote/bootstrap/scripts.js";
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
  /** Distribution channel: it picks the daemon deployment on a host, and whether a sandbox exists. */
  channel: DesktopChannel;
  localDaemonUrl(): string;
  onRemoteStatus(status: RemoteHostStatus): void;
  onLinearDelivery(snapshot: LinearDeliverySnapshot): void;
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
  const deployment = deploymentForChannel(options.channel, options.expectedBuild);
  const sandbox = new PreviewSandbox({
    enabled: options.channel === "preview",
    dataDirectory,
    templateDir: options.paths.sandboxTemplateDir,
    daemon,
    onDaemonStarted: options.onSandboxDaemonStarted,
    remoteHomeSuffix: deployment.homeSuffix,
    log: (message) => desktopLog.write(message),
  });
  const hosts = new ExecutionHostManager({
    dataDir: dataDirectory.root,
    log: (message) => desktopLog.write(message),
    localDaemonUrl: options.localDaemonUrl,
    onRemoteStatus: options.onRemoteStatus,
    onRemoteConnected: (alias, url) => void sandbox.ensureRemote(alias, url),
    applyRendererUrl: options.applyRendererUrl,
    expectedBuild: options.expectedBuild,
    deployment,
  });
  const linear = new LinearCoordinator({
    vault: createMainLinearVault(dataDirectory.root),
    targets: () => linearTargets(hosts),
    onDelivery: options.onLinearDelivery,
  });
  const instances = new RemoteInstanceActions({
    alias: () => hosts.remoteSshAlias,
    deployment,
    expectedBuild: options.expectedBuild,
    repo: OTOMAT_GITHUB_REPO,
    session: () => hosts.remoteSession,
    log: (message) => desktopLog.write(message),
  });
  return { dataDirectory, desktopLog, daemonLog, daemon, linear, hosts, sandbox, instances };
}
