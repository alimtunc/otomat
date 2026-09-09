import type { AgentSessionRow } from "@otomat/db";

import { captureBoundary } from "../pass-boundary.js";
import type { SupervisorState } from "../state.js";

/** What the turn actually did to its worktree, read from git rather than from what the turn said. */
export interface WorktreeDelta {
  changed_files: number;
  committed: boolean;
  end_tree_sha: string | null;
  end_head_sha: string | null;
  /** Why the delta could not be read; a contract that needs it is refused rather than assumed satisfied. */
  evidence_error: string | null;
}

export interface WorktreeDeltaInput {
  runId: string;
  session: AgentSessionRow;
}

export type WorktreeDeltaProbe = (input: WorktreeDeltaInput) => WorktreeDelta;

const NO_START_BOUNDARY = "the pass never recorded the tree it started from";
const NO_REPOSITORY = "this run has no git repository to read";
const TREES_GONE = "the trees this pass ran between are no longer readable";

/** Reads the pass boundary live: the end of a turn is the only instant its own delta is still true. */
export function createWorktreeDeltaProbe(state: SupervisorState): WorktreeDeltaProbe {
  return ({ runId, session }) => {
    const end = captureBoundary(state, runId, session.step_run_id, session.id);
    const bounds = {
      changed_files: 0,
      committed: false,
      end_tree_sha: end.capture?.treeSha ?? null,
      end_head_sha: end.capture?.headSha ?? null,
    };
    if (end.capture === null) return { ...bounds, evidence_error: end.error };
    if (session.start_tree_sha === null) {
      return { ...bounds, evidence_error: session.boundary_error ?? NO_START_BOUNDARY };
    }
    const service = state.repositories.forRun(runId)?.service ?? null;
    if (service === null) return { ...bounds, evidence_error: NO_REPOSITORY };
    const committed =
      session.start_head_sha !== null && session.start_head_sha !== end.capture.headSha;
    const snapshot = service.boundaryDiff(session.start_tree_sha, end.capture.treeSha);
    if (snapshot === null) return { ...bounds, committed, evidence_error: TREES_GONE };
    return {
      ...bounds,
      changed_files: snapshot.diff.files.length,
      committed,
      evidence_error: null,
    };
  };
}
