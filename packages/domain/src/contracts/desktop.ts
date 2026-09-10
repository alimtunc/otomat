import { z } from "zod";

import {
  PLAIN_DATA_SAFETY_ERROR_CODES,
  RECOVERABLE_DATA_SAFETY_ERROR_CODES,
} from "./data-safety.js";
import type { DesktopUpdateSnapshot } from "./desktop-update.js";
import type {
  ErrorDiagnostic,
  ProblemReportDraft,
  SupportBundleExportResult,
} from "./diagnostics.js";
import type {
  ExecutionHostCallResult,
  ExecutionHostCapacityResult,
  ExecutionHostId,
  ExecutionHostOperationResult,
  ExecutionHostProjectsEntry,
  ExecutionHostRegisterProjectResult,
  ExecutionHostRepositoriesEntry,
  ExecutionHostSelectResult,
  ExecutionHostSnapshot,
  RemoteHostStatus,
  RemoteInstanceListResult,
  RemoteRepositoryListResult,
} from "./execution-host.js";
import type { InboxSnapshot } from "./inbox.js";
import type { ConnectLinearRequest, LinearErrorCode } from "./linear.js";
import type { DesktopNotificationsBridge } from "./notifications.js";
import type { ProjectHealthReport } from "./project-health.js";
import type {
  WorkspaceCleanupResult,
  WorkspaceInventory,
  WorkspaceReconcileReport,
} from "./workspace-inventory.js";

const startupDiagnosticBase = z.object({
  message: z.string().min(1),
});

const plainStartupDiagnosticSchema = startupDiagnosticBase.extend({
  code: z.enum([...PLAIN_DATA_SAFETY_ERROR_CODES, "data_directory_invalid", "startup_failed"]),
  backup_path: z.null(),
  available_bytes: z.null(),
  required_bytes: z.null(),
});

const recoverableStartupDiagnosticSchema = startupDiagnosticBase.extend({
  code: z.enum(RECOVERABLE_DATA_SAFETY_ERROR_CODES),
  backup_path: z.string().nullable(),
  available_bytes: z.null(),
  required_bytes: z.null(),
});

const lowDiskStartupDiagnosticSchema = startupDiagnosticBase.extend({
  code: z.literal("low_disk"),
  backup_path: z.null(),
  available_bytes: z.number().int().nonnegative(),
  required_bytes: z.number().int().nonnegative(),
});

export const desktopStartupDiagnosticSchema = z.discriminatedUnion("code", [
  plainStartupDiagnosticSchema,
  recoverableStartupDiagnosticSchema,
  lowDiskStartupDiagnosticSchema,
]);
export type DesktopStartupDiagnostic = z.infer<typeof desktopStartupDiagnosticSchema>;

export type LinearVaultOperationResult =
  | { ok: true; message: null }
  | { ok: false; message: string; error_code: LinearErrorCode | null };

/** `delivered` and `cleared` are confirmed by that host's daemon; the rest is what Otomat still owes it, or could not ask. */
export type LinearHostDeliveryState =
  | "delivered"
  | "cleared"
  | "pending_restore"
  | "pending_revocation"
  | "unavailable";

export interface LinearHostDelivery {
  host_id: ExecutionHostId;
  label: string;
  state: LinearHostDeliveryState;
  /** The last failure this host reported, or why it could not be reached; null when there is none. */
  detail: string | null;
}

/** One vaulted connection and where its key stands on each execution host. */
export interface LinearConnectionDelivery {
  connection_id: string;
  hosts: LinearHostDelivery[];
}

export interface LinearDeliverySnapshot {
  connections: LinearConnectionDelivery[];
}

const WORKSPACE_OPEN_TARGETS = ["vscode", "terminal"] as const;
export type WorkspaceOpenTarget = (typeof WORKSPACE_OPEN_TARGETS)[number];

export function isWorkspaceOpenTarget(value: unknown): value is WorkspaceOpenTarget {
  return WORKSPACE_OPEN_TARGETS.some((target) => target === value);
}

export type PreviewSandboxResetResult =
  | { ok: true; message: null }
  | { ok: false; message: string };

/** Identity of the running shell build, so a copied diagnostic names the artifact it came from. */
export interface DesktopBuildSummary {
  version: string;
  commit: string;
  channel: string;
}

/**
 * The narrow surface the Electron desktop shell exposes to the renderer through
 * `contextBridge` as `window.otomat`. Absent in the browser (dev/web), where the
 * daemon URL comes from the build-time env and there is no native folder picker.
 */
export interface OtomatDesktopBridge {
  notifications: DesktopNotificationsBridge;
  /** Origin of the host active at page load: the local daemon, or the SSH tunnel's local end. */
  readonly daemonUrl: string;
  /** Active host at page load; a later switch answers with its own origin. */
  readonly executionHostId: ExecutionHostId;
  /** Configured `~/.ssh/config` alias of the remote host, or null when none is configured. */
  readonly executionHostSshAlias: string | null;
  /** Version, commit and channel of this shell build, read at page load. */
  readonly build: DesktopBuildSummary;
  /** Opens the native directory chooser; resolves to the absolute path, or null when canceled. */
  pickDirectory(): Promise<string | null>;
  /** Subscribes to the run the shell was asked to show, from the menu bar; returns the unsubscribe function. */
  onOpenRun(listener: (runId: string) => void): () => void;
  executionHost: {
    snapshot(): Promise<ExecutionHostSnapshot>;
    select(id: ExecutionHostId): Promise<ExecutionHostSelectResult>;
    configureRemote(sshAlias: string): Promise<ExecutionHostOperationResult>;
    /** Forgets the remote host: closes the tunnel and clears the alias. Nothing on the server is touched. */
    removeRemote(): Promise<ExecutionHostOperationResult>;
    registerProject(
      hostId: ExecutionHostId,
      path: string,
    ): Promise<ExecutionHostRegisterProjectResult>;
    /** Reads one host's session cap from that host's own daemon; the desktop shell keeps no copy of it. */
    readCapacity(hostId: ExecutionHostId): Promise<ExecutionHostCapacityResult>;
    /** Saves the cap on the host that enforces it; an unreachable or refusing host comes back `ok: false`. */
    writeCapacity(
      hostId: ExecutionHostId,
      maxConcurrentSessions: number,
    ): Promise<ExecutionHostCapacityResult>;
    listSshAliases(): Promise<string[]>;
    /** Git working trees found under the remote host's `$HOME`; a truncated listing is a failure, never an empty list. */
    listRemoteRepositories(): Promise<RemoteRepositoryListResult>;
    /** Every configured host with its project catalog, fetched by the main process so the renderer never talks to the inactive daemon directly. */
    listProjects(): Promise<ExecutionHostProjectsEntry[]>;
    listRepositories(): Promise<ExecutionHostRepositoriesEntry[]>;
    /** Deletes the repository with its project and its runs. */
    deleteRepository(
      hostId: ExecutionHostId,
      repositoryId: string,
    ): Promise<ExecutionHostOperationResult>;
    readWorkspaces(hostId: ExecutionHostId): Promise<ExecutionHostCallResult<WorkspaceInventory>>;
    /** One host's Inbox, so a project that is not on screen keeps its badge. */
    readInbox(hostId: ExecutionHostId): Promise<ExecutionHostCallResult<InboxSnapshot>>;
    /** One host's readiness report for the project it holds under that id; only that host can run its own checks. */
    readProjectHealth(
      hostId: ExecutionHostId,
      projectId: string,
    ): Promise<ExecutionHostCallResult<ProjectHealthReport>>;
    reconcileWorkspaces(
      hostId: ExecutionHostId,
    ): Promise<ExecutionHostCallResult<WorkspaceReconcileReport>>;
    cleanupWorkspace(
      hostId: ExecutionHostId,
      workspaceId: string,
      force: boolean,
    ): Promise<ExecutionHostCallResult<WorkspaceCleanupResult>>;
    /** Opens a worktree the host's daemon lists, in VS Code or a terminal; the main process verifies the path before any launch. */
    openWorkspace(
      hostId: ExecutionHostId,
      path: string,
      target: WorkspaceOpenTarget,
    ): Promise<ExecutionHostOperationResult>;
    /** Subscribes to live remote-connection status; returns the unsubscribe function. */
    onRemoteStatus(listener: (status: RemoteHostStatus) => void): () => void;
    /** Preview daemons under `~/.otomat/instances` on the remote host. */
    listInstances(): Promise<RemoteInstanceListResult>;
    stopInstance(build: string): Promise<ExecutionHostOperationResult>;
    deleteInstance(build: string): Promise<ExecutionHostOperationResult>;
    /** Retries the automatic daemon update now: the same install the host runs by itself, minus its one-attempt memory. */
    updateRemoteDaemon(): Promise<ExecutionHostOperationResult>;
  };
  linear: {
    /** Connects one catalogued workspace: the key is vaulted here and handed to every host's daemon. */
    saveKey(request: ConnectLinearRequest): Promise<LinearVaultOperationResult>;
    /** Erases one connection from the vault and revokes it on every reachable host. */
    forgetKey(connectionId: string): Promise<LinearVaultOperationResult>;
    /** Where each vaulted connection stands on each execution host right now. */
    delivery(): Promise<LinearDeliverySnapshot>;
    /** Subscribes to delivery changes pushed by the main process; returns the unsubscribe function. */
    onDelivery(listener: (snapshot: LinearDeliverySnapshot) => void): () => void;
  };
  support: {
    /** Writes the local support bundle, with this incident attached, to a path the user picks. */
    exportBundle(diagnostic: ErrorDiagnostic): Promise<SupportBundleExportResult>;
    /** Opens the prepared draft in the user's browser. Nothing is sent; the user posts it or not. */
    openReportDraft(draft: ProblemReportDraft): Promise<void>;
  };
  update: {
    /** Where the shell's own update stands right now; null before the shell's runtime is up. */
    snapshot(): Promise<DesktopUpdateSnapshot | null>;
    /** Looks for a release now, ignoring the startup cooldown. */
    check(): Promise<void>;
    /** Replaces the app and relaunches it — refused, with a reason, while any host is working. */
    install(): Promise<void>;
    /** Subscribes to update state pushed by the main process; returns the unsubscribe function. */
    onChange(listener: (snapshot: DesktopUpdateSnapshot) => void): () => void;
  };
  /** True for a packaged preview (unsigned build); the sandbox surface is only shown — and its reset only honored — when true. */
  readonly preview: boolean;
  sandbox: {
    /** Stops the local daemon, wipes the sandbox data and fixture repository, restarts and reseeds. */
    reset(): Promise<PreviewSandboxResetResult>;
  };
}
