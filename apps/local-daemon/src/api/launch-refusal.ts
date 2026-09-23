import type { RunLaunchError } from "@otomat/domain";
import type { Context, Env } from "hono";

import { LaunchRefusedError } from "#supervisor";

const LAUNCH_REFUSAL_STATUS = {
  project_not_found: 400,
  project_mismatch: 400,
  base_branch_not_found: 400,
  base_remote_unavailable: 409,
  repository_required: 409,
  repository_unavailable: 409,
  worktree_unavailable: 409,
  issue_workspace_open: 409,
  launches_held: 409,
  context_too_large: 400,
} satisfies Record<RunLaunchError, 400 | 409>;

export function launchRefusalResponse<E extends Env>(
  c: Context<E>,
  error: unknown,
): Response | null {
  if (!(error instanceof LaunchRefusedError)) return null;
  return c.json(
    { error: error.code, message: error.message, run_id: error.runId, remote: error.remote },
    LAUNCH_REFUSAL_STATUS[error.code],
  );
}
