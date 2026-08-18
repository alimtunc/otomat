import { getStepRun, listAgentSessionsForRun, type AgentSessionRow } from "@otomat/db";
import { shortSha, type RunDiffScope, type RunDiffScopeSelector } from "@otomat/domain";

import { diffSnapshotOrNull, type GitWorktreeService } from "#git";

import { DiffScopeNotFoundError } from "./errors.js";
import { resolveReviewSubject } from "./subject.js";
import type { ReviewContext, ReviewSubjectRef, ScopedDiff } from "./types.js";

const NO_REPOSITORY = "This run has no git repository, so no diff can be reconstructed.";
const NO_WORKTREE = "This run has no worktree, so there is no current diff to show.";
const NO_IMPORTED_HEAD = "The imported head of this pull request can no longer be read.";

function unavailable(scope: RunDiffScope, reason: string): ScopedDiff {
  return { scope, snapshot: null, unavailable: reason };
}

function resolveWorkspace(service: GitWorktreeService, owner: string): ScopedDiff {
  const snapshot = diffSnapshotOrNull(service, owner);
  const scope: RunDiffScope = { kind: "workspace" };
  return snapshot === null
    ? unavailable(scope, NO_WORKTREE)
    : { scope, snapshot, unavailable: null };
}

function resolveCommit(service: GitWorktreeService, commit: string): ScopedDiff {
  const resolved = service.commitScope(commit);
  if (resolved === null) {
    throw new DiffScopeNotFoundError(
      "commit_not_found",
      `commit ${commit} is not in this repository`,
    );
  }
  return {
    scope: {
      kind: "commit",
      commit: resolved.commit.sha,
      short_sha: shortSha(resolved.commit.sha),
      subject: resolved.commit.subject,
      parent: resolved.parent,
    },
    snapshot: resolved.snapshot,
    unavailable: null,
  };
}

function passUnavailable(session: AgentSessionRow): string {
  if (session.boundary_error !== null) return session.boundary_error;
  if (session.start_tree_sha === null) {
    return "This pass started before Otomat captured a git boundary for it.";
  }
  return "This pass has not finished, so its end boundary is not captured yet.";
}

function resolveSession(
  ctx: ReviewContext,
  service: GitWorktreeService,
  runId: string,
  agentSessionId: string,
): ScopedDiff {
  const session = listAgentSessionsForRun(ctx.db, runId).find((row) => row.id === agentSessionId);
  if (!session) {
    throw new DiffScopeNotFoundError(
      "session_not_found",
      `session ${agentSessionId} is not a pass of this run`,
    );
  }
  const step = getStepRun(ctx.db, session.step_run_id);
  const scope: RunDiffScope = {
    kind: "session",
    agent_session_id: session.id,
    step_name: step?.name ?? "Unknown step",
    start_tree_sha: session.start_tree_sha ?? "",
    end_tree_sha: session.end_tree_sha ?? "",
  };
  const { start_tree_sha: start, end_tree_sha: end } = session;
  if (start === null || end === null) return unavailable(scope, passUnavailable(session));

  const snapshot = service.boundaryDiff(start, end);
  return snapshot === null
    ? unavailable(scope, "Git no longer holds the trees this pass was captured against.")
    : { scope, snapshot, unavailable: null };
}

/** An adopted pull request has exactly one scope: its pinned imported head. */
function resolvePinnedHead(ctx: ReviewContext, ref: ReviewSubjectRef): ScopedDiff {
  const snapshot = resolveReviewSubject(ctx, ref).snapshot();
  const scope: RunDiffScope = { kind: "workspace" };
  return snapshot === null
    ? unavailable(scope, NO_IMPORTED_HEAD)
    : { scope, snapshot, unavailable: null };
}

/** The single place a scope becomes a snapshot, so no surface pairs one scope's descriptor with another's content. */
export function resolveScope(
  ctx: ReviewContext,
  ref: ReviewSubjectRef,
  request: RunDiffScopeSelector,
): ScopedDiff {
  if (ref.kind === "pull_request") return resolvePinnedHead(ctx, ref);
  const service = ctx.repositories.forRun(ref.id)?.service ?? null;
  if (service === null) return unavailable({ kind: "workspace" }, NO_REPOSITORY);
  if (request.kind === "commit") return resolveCommit(service, request.commit);
  if (request.kind === "session") {
    return resolveSession(ctx, service, ref.id, request.session);
  }
  return resolveWorkspace(service, ref.owner ?? ref.id);
}
