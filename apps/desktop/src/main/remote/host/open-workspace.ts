import type {
  ExecutionHostCallResult,
  ExecutionHostId,
  ExecutionHostOperationResult,
  WorkspaceInventory,
  WorkspaceOpenTarget,
} from "@otomat/domain";

import { failureMessage } from "#shared/failure-message";

export interface WorkspaceLaunchers {
  platform: NodeJS.Platform;
  /** Name of the app registered for a URL scheme; empty when nothing handles it. */
  protocolHandler(url: string): string;
  openExternal(url: string): Promise<void>;
  /** Runs one executable with an argument array; never a shell string. */
  launch(file: string, args: string[]): Promise<void>;
}

export interface OpenWorkspaceOptions {
  readWorkspaces(hostId: ExecutionHostId): Promise<ExecutionHostCallResult<WorkspaceInventory>>;
  remoteSshAlias(): string | null;
  launchers: WorkspaceLaunchers;
}

const VSCODE_SCHEME = "vscode://";

function encodeWorkspacePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function vscodeUrl(alias: string | null, path: string): string {
  const encoded = encodeWorkspacePath(path);
  if (alias === null) return `${VSCODE_SCHEME}file${encoded}`;
  return `${VSCODE_SCHEME}vscode-remote/ssh-remote+${encodeURIComponent(alias)}${encoded}`;
}

async function launchTarget(
  options: OpenWorkspaceOptions,
  hostId: ExecutionHostId,
  path: string,
  target: WorkspaceOpenTarget,
): Promise<ExecutionHostOperationResult> {
  const { launchers } = options;
  if (target === "vscode") {
    if (launchers.protocolHandler(VSCODE_SCHEME) === "") {
      return {
        ok: false,
        message: "VS Code is not installed, or nothing handles vscode:// links.",
      };
    }
    const alias = hostId === "remote" ? options.remoteSshAlias() : null;
    if (hostId === "remote" && alias === null) {
      return { ok: false, message: "No SSH alias is registered for the remote host." };
    }
    try {
      await launchers.openExternal(vscodeUrl(alias, path));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: `VS Code did not open: ${failureMessage(error)}` };
    }
  }
  if (hostId === "remote") {
    return {
      ok: false,
      message: "No terminal integration exists for a remote host; copy the ssh command instead.",
    };
  }
  if (launchers.platform !== "darwin") {
    return { ok: false, message: "Opening a terminal is supported on macOS only." };
  }
  try {
    await launchers.launch("open", ["-a", "Terminal", path]);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: `Terminal did not open: ${failureMessage(error)}` };
  }
}

/** Opens only a path the owning daemon lists as a present worktree; the main checkout is never listed, so it is never opened by approximation. */
export async function openWorkspace(
  options: OpenWorkspaceOptions,
  hostId: ExecutionHostId,
  path: string,
  target: WorkspaceOpenTarget,
): Promise<ExecutionHostOperationResult> {
  const inventory = await options.readWorkspaces(hostId);
  if (!inventory.ok) return inventory;
  const entry = inventory.value.entries.find((candidate) => candidate.path === path);
  if (entry === undefined) {
    return { ok: false, message: "This path is not a worktree the host's daemon knows about." };
  }
  if (!entry.present) {
    return { ok: false, message: `The worktree directory is missing on ${hostId}: ${path}` };
  }
  return launchTarget(options, hostId, path, target);
}
