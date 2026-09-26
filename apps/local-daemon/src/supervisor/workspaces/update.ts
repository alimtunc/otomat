import { getRun } from "@otomat/db";
import {
  redactLogText,
  type RemoteBaseRefusal,
  type RemoteRefComparison,
  type UpdateWorkspaceRequest,
  type WorkspaceAbandonBlocker,
  type WorkspaceFreshness,
  type WorkspaceUpdateError,
  type WorkspaceUpdateStrategy,
  WORKSPACE_UPDATE_BLOCKED,
} from "@otomat/domain";

import {
  compareWithRemote,
  fetchRemoteTips,
  inCheckout,
  integrateCommit,
  IntegrationAbortedError,
  RemoteBaseError,
  uncommittedPaths,
  type RemoteTips,
} from "#git";
import { serializeByKey } from "#serialize";

import { abandonBlocker } from "../abandon.js";
import { deliverQueuedContributions } from "../contribution/index.js";
import { LaunchRefusedError } from "../launch-target.js";
import { trackPending, type SupervisorState } from "../state.js";
import { compareFreshness, freshnessTarget, type FreshnessTarget } from "./freshness.js";

export class WorkspaceUpdateRefusedError extends Error {
  readonly conflicts: string[];
  readonly remote: RemoteBaseRefusal | null;

  constructor(
    readonly code: WorkspaceUpdateError,
    message: string,
    details: { conflicts?: string[]; remote?: RemoteBaseRefusal } = {},
  ) {
    super(message);
    this.name = "WorkspaceUpdateRefusedError";
    this.conflicts = details.conflicts ?? [];
    this.remote = details.remote ?? null;
  }
}

const BLOCKER_MESSAGES = {
  workspace_closed: "This run no longer holds its issue's workspace.",
  run_active: WORKSPACE_UPDATE_BLOCKED.run_active,
} satisfies Record<WorkspaceAbandonBlocker, string>;

const STRATEGY_PHRASES = { rebase: "Rebasing onto", merge: "Merging" } satisfies Record<
  WorkspaceUpdateStrategy,
  string
>;

export function requireWorkspaceSteady(state: SupervisorState, runId: string): void {
  if (state.updatingWorkspaces.has(runId)) {
    throw new LaunchRefusedError(
      "workspace_updating",
      "This workspace is being updated from its remote; start new work once the update finishes.",
    );
  }
}

async function fetchTips(target: FreshnessTarget): Promise<RemoteTips> {
  try {
    return await fetchRemoteTips(target.path, target.branch, target.baseRef);
  } catch (error) {
    if (!(error instanceof RemoteBaseError)) throw error;
    throw new WorkspaceUpdateRefusedError("remote_unavailable", error.message, {
      remote: error.remote,
    });
  }
}

function notOffered(comparison: RemoteRefComparison | null): WorkspaceUpdateRefusedError {
  const message =
    comparison === null || comparison.behind === 0
      ? "The workspace already carries everything this remote ref holds."
      : `The workspace changed since it was checked, and that update from ${comparison.ref} is no longer offered; check again.`;
  return new WorkspaceUpdateRefusedError("strategy_unavailable", message);
}

async function integrate(
  target: FreshnessTarget,
  comparison: RemoteRefComparison,
  strategy: WorkspaceUpdateStrategy,
): Promise<void> {
  try {
    await integrateCommit(
      target.path,
      comparison.sha,
      strategy,
      `Merge ${comparison.ref} into ${target.branch}`,
    );
  } catch (error) {
    if (!(error instanceof IntegrationAbortedError)) throw error;
    const action = `${STRATEGY_PHRASES[strategy]} ${comparison.ref}`;
    if (error.conflicts.length > 0) {
      throw new WorkspaceUpdateRefusedError(
        "update_conflict",
        `${action} stopped on conflicts; Otomat aborted it, so the workspace is exactly as it was.`,
        { conflicts: error.conflicts },
      );
    }
    throw new WorkspaceUpdateRefusedError(
      "update_failed",
      `${action} failed and was aborted, so the workspace is unchanged: ${redactLogText(error.stderr).trim()}`,
    );
  }
}

async function performUpdate(
  state: SupervisorState,
  runId: string,
  target: FreshnessTarget,
  request: UpdateWorkspaceRequest,
): Promise<WorkspaceFreshness> {
  const run = getRun(state.db, runId);
  const blocker = run ? abandonBlocker(state, run) : "workspace_closed";
  if (blocker !== null) throw new WorkspaceUpdateRefusedError(blocker, BLOCKER_MESSAGES[blocker]);
  const tips = await fetchTips(target);
  return inCheckout(target.path, async () => {
    if ((await uncommittedPaths(target.path)).length > 0) {
      throw new WorkspaceUpdateRefusedError(
        "workspace_dirty",
        WORKSPACE_UPDATE_BLOCKED.workspace_dirty,
      );
    }
    const comparison = (await compareWithRemote(target.path, tips))[request.source];
    if (comparison === null || !comparison.strategies.includes(request.strategy)) {
      throw notOffered(comparison);
    }
    await integrate(target, comparison, request.strategy);
    return compareFreshness(target.path, tips);
  });
}

export async function updateWorkspace(
  state: SupervisorState,
  runId: string,
  request: UpdateWorkspaceRequest,
): Promise<WorkspaceFreshness> {
  if (state.updatingWorkspaces.has(runId)) {
    throw new WorkspaceUpdateRefusedError(
      "workspace_updating",
      "This workspace is already being updated.",
    );
  }
  const target = freshnessTarget(state, runId);
  state.updatingWorkspaces.add(runId);
  try {
    return await serializeByKey(state.advancing, runId, () =>
      performUpdate(state, runId, target, request),
    );
  } finally {
    state.updatingWorkspaces.delete(runId);
    void trackPending(
      state,
      deliverQueuedContributions(state, runId).catch((error: unknown) =>
        console.error(`[otomat] run ${runId} messages held by a workspace update failed`, error),
      ),
    );
  }
}
