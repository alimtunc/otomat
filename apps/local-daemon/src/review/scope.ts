import {
  getPullRequestForRun,
  getStepRun,
  listAgentSessionsForRun,
  type AgentSessionRow,
  type PullRequestRow,
} from "@otomat/db";
import {
  shortSha,
  stepPassBounds,
  type RunDiffScope,
  type RunDiffScopeSelector,
} from "@otomat/domain";

import {
  branchDiffOrNull,
  treeRangeSnapshot,
  type GitWorktreeService,
  type RepositoryBinding,
} from "#git";

import { DiffScopeNotFoundError } from "./errors.js";
import { pullRequestTrees, reviewAnchorSha, runDiffBaseRef } from "./pull-request.js";
import { resolveReviewSubject } from "./subject.js";
import type { ReviewContext, ReviewSubjectRef, ScopedDiff } from "./types.js";

const NO_REPOSITORY = "This run has no git repository, so no diff can be reconstructed.";
const NO_WORKTREE = "This run has no worktree, so there is no current diff to show.";
const NO_PULL_REQUEST = "This run has no pull request yet, so there is no published diff to show.";
const NO_HEAD_RECORDED = "No head commit is recorded for this pull request yet, so it has no diff.";
const NO_PUBLISHED_HEAD =
  "This clone can no longer read the head and base this pull request spans.";
const PRUNED_TREES = "Git no longer holds the trees this slice was captured against.";

function unavailable(scope: RunDiffScope, reason: string): ScopedDiff {
  return { scope, snapshot: null, unavailable: reason };
}

function resolveBranch(
  ctx: ReviewContext,
  service: GitWorktreeService,
  runId: string,
  owner: string,
): ScopedDiff {
  const resolved = branchDiffOrNull(service, owner, runDiffBaseRef(ctx.db, runId));
  if (resolved === null) {
    return unavailable({ kind: "branch", branch: null, base_ref: null }, NO_WORKTREE);
  }
  return {
    scope: { kind: "branch", branch: resolved.branch, base_ref: resolved.baseRef },
    snapshot: resolved.snapshot,
    unavailable: null,
  };
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

function boundaryUnavailable(passes: readonly AgentSessionRow[], subject: "pass" | "step"): string {
  for (const pass of passes) {
    if (pass.boundary_error !== null) return pass.boundary_error;
  }
  const first = passes[0];
  if (first === undefined) return `This ${subject} has not run yet, so it captured no boundary.`;
  if (first.start_tree_sha === null) {
    return `This ${subject} started before Otomat captured a git boundary for it.`;
  }
  return `This ${subject} has not finished, so its end boundary is not captured yet.`;
}

function resolveSession(
  ctx: ReviewContext,
  service: GitWorktreeService,
  runId: string,
  agentSessionId: string,
): ScopedDiff {
  const pass = listAgentSessionsForRun(ctx.db, runId).find((row) => row.id === agentSessionId);
  if (!pass) {
    throw new DiffScopeNotFoundError(
      "session_not_found",
      `session ${agentSessionId} is not a pass of this run`,
    );
  }
  const step = getStepRun(ctx.db, pass.step_run_id);
  const scope: RunDiffScope = {
    kind: "session",
    agent_session_id: pass.id,
    step_name: step?.name ?? "Unknown step",
  };
  const bounds = stepPassBounds([pass]);
  if (bounds === null) return unavailable(scope, boundaryUnavailable([pass], "pass"));

  const snapshot = service.boundaryDiff(bounds.start_tree_sha, bounds.end_tree_sha);
  return snapshot === null
    ? unavailable(scope, PRUNED_TREES)
    : { scope, snapshot, unavailable: null };
}

function resolveStep(
  ctx: ReviewContext,
  service: GitWorktreeService,
  runId: string,
  stepRunId: string,
): ScopedDiff {
  const step = getStepRun(ctx.db, stepRunId);
  if (!step || step.run_id !== runId) {
    throw new DiffScopeNotFoundError(
      "step_not_found",
      `step ${stepRunId} is not a step of this run`,
    );
  }
  const scope: RunDiffScope = {
    kind: "step",
    step_run_id: step.id,
    step_name: step.name,
    step_number: step.idx + 1,
  };
  const passes = listAgentSessionsForRun(ctx.db, runId).filter(
    (pass) => pass.step_run_id === stepRunId,
  );
  const bounds = stepPassBounds(passes);
  if (bounds === null) return unavailable(scope, boundaryUnavailable(passes, "step"));

  const snapshot = service.boundaryDiff(bounds.start_tree_sha, bounds.end_tree_sha);
  return snapshot === null
    ? unavailable(scope, PRUNED_TREES)
    : { scope, snapshot, unavailable: null };
}

function resolvePullRequest(
  row: PullRequestRow | null,
  binding: RepositoryBinding | null,
): ScopedDiff {
  const scope: RunDiffScope = { kind: "pull_request", number: row?.number ?? null };
  if (row === null) return unavailable(scope, NO_PULL_REQUEST);
  if (binding === null) return unavailable(scope, NO_REPOSITORY);
  const anchor = reviewAnchorSha(row);
  if (anchor === null || anchor === "") return unavailable(scope, NO_HEAD_RECORDED);
  const trees = pullRequestTrees(row, binding);
  return trees === null
    ? unavailable(scope, NO_PUBLISHED_HEAD)
    : {
        scope,
        snapshot: treeRangeSnapshot(binding.rootPath, trees.base, trees.head),
        unavailable: null,
      };
}

/** An adopted pull request is its own subject and has exactly one scope: the head it is pinned to. */
function resolveAdoptedPullRequest(ctx: ReviewContext, ref: ReviewSubjectRef): ScopedDiff {
  const row = resolveReviewSubject(ctx, ref).pullRequest();
  return resolvePullRequest(
    row,
    row === null ? null : ctx.repositories.forRepository(row.repository_id),
  );
}

/** The single place a scope becomes a snapshot, so no surface pairs one scope's descriptor with another's content. */
export function resolveScope(
  ctx: ReviewContext,
  ref: ReviewSubjectRef,
  request: RunDiffScopeSelector,
): ScopedDiff {
  if (ref.kind === "pull_request") return resolveAdoptedPullRequest(ctx, ref);
  const binding = ctx.repositories.forRun(ref.id);
  if (binding === null) {
    return unavailable({ kind: "branch", branch: null, base_ref: null }, NO_REPOSITORY);
  }
  if (request.kind === "commit") return resolveCommit(binding.service, request.commit);
  if (request.kind === "step") return resolveStep(ctx, binding.service, ref.id, request.step);
  if (request.kind === "session") {
    return resolveSession(ctx, binding.service, ref.id, request.session);
  }
  if (request.kind === "pull_request") {
    return resolvePullRequest(getPullRequestForRun(ctx.db, ref.id) ?? null, binding);
  }
  return resolveBranch(ctx, binding.service, ref.id, ref.owner ?? ref.id);
}
