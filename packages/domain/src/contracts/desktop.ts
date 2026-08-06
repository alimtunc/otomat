import { z } from "zod";

import {
  PLAIN_DATA_SAFETY_ERROR_CODES,
  RECOVERABLE_DATA_SAFETY_ERROR_CODES,
} from "./data-safety.js";
import type {
  ExecutionHostId,
  ExecutionHostOperationResult,
  ExecutionHostProjectsEntry,
  ExecutionHostRegisterProjectResult,
  ExecutionHostSnapshot,
  RemoteHostStatus,
  RemoteInstanceListResult,
  RemoteRepositoryListResult,
} from "./execution-host.js";
import type { LinearErrorCode } from "./linear.js";

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

export type PreviewSandboxResetResult =
  | { ok: true; message: null }
  | { ok: false; message: string };

/**
 * The narrow surface the Electron desktop shell exposes to the renderer through
 * `contextBridge` as `window.otomat`. Absent in the browser (dev/web), where the
 * daemon URL comes from the build-time env and there is no native folder picker.
 */
export interface OtomatDesktopBridge {
  /** Origin the renderer talks to: the local daemon, or the SSH tunnel's local end when the remote host is active. */
  readonly daemonUrl: string;
  /** Active host at page load; every host switch reloads the renderer, so this is stable per load. */
  readonly executionHostId: ExecutionHostId;
  /** Configured `~/.ssh/config` alias of the remote host, or null when none is configured. */
  readonly executionHostSshAlias: string | null;
  /** Opens the native directory chooser; resolves to the absolute path, or null when canceled. */
  pickDirectory(): Promise<string | null>;
  executionHost: {
    snapshot(): Promise<ExecutionHostSnapshot>;
    select(id: ExecutionHostId): Promise<ExecutionHostOperationResult>;
    configureRemote(sshAlias: string): Promise<ExecutionHostOperationResult>;
    /** Forgets the remote host: closes the tunnel and clears the alias. Nothing on the server is touched. */
    removeRemote(): Promise<ExecutionHostOperationResult>;
    registerProject(
      hostId: ExecutionHostId,
      path: string,
    ): Promise<ExecutionHostRegisterProjectResult>;
    listSshAliases(): Promise<string[]>;
    /** Git working trees found under the remote host's `$HOME`; a truncated listing is a failure, never an empty list. */
    listRemoteRepositories(): Promise<RemoteRepositoryListResult>;
    /** Every configured host with its project catalog, fetched by the main process so the renderer never talks to the inactive daemon directly. */
    listProjects(): Promise<ExecutionHostProjectsEntry[]>;
    /** Subscribes to live remote-connection status; returns the unsubscribe function. */
    onRemoteStatus(listener: (status: RemoteHostStatus) => void): () => void;
    /** Preview daemons under `~/.otomat/instances` on the remote host. */
    listInstances(): Promise<RemoteInstanceListResult>;
    stopInstance(build: string): Promise<ExecutionHostOperationResult>;
    deleteInstance(build: string): Promise<ExecutionHostOperationResult>;
    /** Deploys the CI bundle for this app's expected build to its own remote target; nothing starts automatically. */
    updateRemoteDaemon(): Promise<ExecutionHostOperationResult>;
  };
  linear: {
    saveKey(apiKey: string): Promise<LinearVaultOperationResult>;
    forgetKey(): Promise<LinearVaultOperationResult>;
  };
  /** True for a packaged preview (unsigned build); the sandbox surface is only shown — and its reset only honored — when true. */
  readonly preview: boolean;
  sandbox: {
    /** Stops the local daemon, wipes the sandbox data and fixture repository, restarts and reseeds. */
    reset(): Promise<PreviewSandboxResetResult>;
  };
}
