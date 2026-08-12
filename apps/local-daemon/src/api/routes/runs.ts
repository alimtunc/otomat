import { CompeteWinnerConflictError, getPullRequestForRun, getRun } from "@otomat/db";
import {
  appendRunStepRequestSchema,
  IllegalTransitionError,
  selectCompeteWinnerRequestSchema,
  startRunRequestSchema,
  type RunLaunchError,
} from "@otomat/domain";
import { Hono, type Context, type Env } from "hono";

import { RuntimeUnavailableError } from "#runtime";
import {
  LaunchRefusedError,
  RunNotResumableError,
  WorkspaceAbandonRefusedError,
} from "#supervisor";

import { agentConfigErrorResponse, refusalJson } from "../agent-config-refusal.js";
import { projectRunCompletionReport } from "../completion-report.js";
import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { readCompeteCandidate, readRunDetail, readRuns } from "../reads.js";
import { toRunDiffResponse } from "../serialize-run-diff.js";
import { toPullRequest, toRun } from "../serialize.js";
import { streamRunEvents } from "../sse.js";
import { appendStepSelector, stepAppendErrorResponse } from "../step-append.js";

const LAUNCH_REFUSAL_STATUS: Record<RunLaunchError, 400 | 409> = {
  project_not_found: 400,
  project_mismatch: 400,
  base_branch_not_found: 400,
  repository_required: 409,
  repository_unavailable: 409,
  worktree_unavailable: 409,
  issue_workspace_open: 409,
};

/** Mounted at `/api/runs`. Holds the run reads, the run commands (start/resume/abort), and the SSE stream. */
export function createRunRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  const runDetailJson = <E extends Env>(c: Context<E>, runId: string) => {
    const detail = readRunDetail(deps.db, runId, {
      wait: deps.supervisor.waitFor(runId),
      resume: deps.supervisor.resumePlan(runId),
    });
    return detail ? c.json(detail) : c.json({ error: "run_not_found" }, 404);
  };

  routes.get("/", (c) =>
    c.json(
      readRuns(deps.db, {
        issueId: c.req.query("issueId"),
        projectId: c.req.query("projectId"),
      }),
    ),
  );

  routes.post("/", validateJson(startRunRequestSchema), async (c) => {
    try {
      const launched = await deps.supervisor.start(c.req.valid("json"));
      // Re-read with the wait in the same tick, so the status and the reason it is queued agree.
      const run = getRun(deps.db, launched.id) ?? launched;
      return c.json({ run: toRun(run), wait: deps.supervisor.waitFor(run.id) }, 201);
    } catch (error) {
      if (error instanceof LaunchRefusedError) {
        const status = LAUNCH_REFUSAL_STATUS[error.code];
        return c.json({ error: error.code, message: error.message, run_id: error.runId }, status);
      }
      if (error instanceof RuntimeUnavailableError) {
        return c.json(
          {
            error: "runtime_unavailable",
            runtime: error.runtime,
            reason: error.reason,
            message: error.message,
          },
          409,
        );
      }
      const refusal = agentConfigErrorResponse(error);
      if (refusal) return refusalJson(c, refusal);
      console.error("[otomat] launch run failed", error);
      return c.json({ error: "run_launch_failed" }, 500);
    }
  });

  routes.get("/:id", (c) => runDetailJson(c, c.req.param("id")));

  routes.get("/:id/report", (c) => {
    const report = projectRunCompletionReport(deps.db, c.req.param("id"), deps.review);
    return report ? c.json(report) : c.json({ error: "run_not_found" }, 404);
  });

  routes.post("/:id/resume", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      return c.json(toRun(await deps.supervisor.resume(run.id)));
    } catch (error) {
      if (error instanceof RunNotResumableError) {
        return c.json({ error: "run_not_resumable", message: error.message }, 409);
      }
      if (error instanceof IllegalTransitionError && error.machine === "issue") {
        return c.json({ error: "issue_closed", message: error.message }, 409);
      }
      console.error(`[otomat] resume run ${run.id} failed`, error);
      return c.json({ error: "run_resume_failed" }, 500);
    }
  });

  routes.get("/:id/workspace", runGuard(deps.db), (c) => {
    const run = c.get("run");
    try {
      const facts = deps.supervisor.workspaceClosure(run.id);
      if (!facts) return c.json({ error: "run_not_found" }, 404);
      const pullRequest = getPullRequestForRun(deps.db, run.id);
      return c.json({
        ...facts,
        pull_request: pullRequest ? toPullRequest(pullRequest, null) : null,
      });
    } catch (error) {
      console.error(`[otomat] reading the workspace of run ${run.id} failed`, error);
      return c.json({ error: "workspace_summary_failed" }, 500);
    }
  });

  routes.post("/:id/abandon", runGuard(deps.db), (c) => {
    const run = c.get("run");
    try {
      return c.json(toRun(deps.supervisor.abandon(run.id)));
    } catch (error) {
      if (error instanceof WorkspaceAbandonRefusedError) {
        return c.json({ error: error.code, message: error.message }, 409);
      }
      console.error(`[otomat] abandoning the workspace of run ${run.id} failed`, error);
      return c.json({ error: "workspace_abandon_failed" }, 500);
    }
  });

  routes.post(
    "/:id/steps",
    validateJson(appendRunStepRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      const request = c.req.valid("json");
      try {
        const updated = await deps.supervisor.appendStep(run.id, {
          name: request.name,
          prompt: request.prompt,
          selector: appendStepSelector(request),
          ...(request.model ? { model: request.model } : {}),
          dependsOn: request.depends_on,
          origin: "user",
        });
        return c.json(toRun(updated), 201);
      } catch (error) {
        const refusal = stepAppendErrorResponse(c, error);
        if (refusal) return refusal;
        console.error(`[otomat] appending a step to run ${run.id} failed`, error);
        return c.json({ error: "step_append_failed" }, 500);
      }
    },
  );

  routes.get("/:id/compete-groups/:groupId/candidates/:stepId/diff", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const step = readCompeteCandidate(
      deps.db,
      run.id,
      c.req.param("groupId"),
      c.req.param("stepId"),
    );
    if (!step) return c.json({ error: "compete_candidate_not_found" }, 404);
    try {
      return c.json(toRunDiffResponse(run.id, deps.review.getWorktreeDiff(run, step.id)));
    } catch (error) {
      console.error(`[otomat] compete candidate diff ${step.id} failed`, error);
      return c.json({ error: "compete_diff_failed" }, 500);
    }
  });

  routes.post(
    "/:id/compete-groups/:groupId/winner",
    validateJson(selectCompeteWinnerRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      try {
        await deps.supervisor.selectWinner(
          run.id,
          c.req.param("groupId"),
          c.req.valid("json").step_run_id,
        );
        return runDetailJson(c, run.id);
      } catch (error) {
        if (error instanceof CompeteWinnerConflictError) {
          return c.json({ error: "compete_winner_conflict", message: error.message }, 409);
        }
        console.error(`[otomat] compete winner selection on run ${run.id} failed`, error);
        return c.json({ error: "compete_winner_selection_failed" }, 500);
      }
    },
  );

  routes.post("/:id/abort", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      await deps.supervisor.abort(run.id);
    } catch (error) {
      console.error(`[otomat] abort run ${run.id} failed`, error);
      return c.json({ error: "run_abort_failed" }, 500);
    }
    return runDetailJson(c, run.id);
  });

  routes.get("/:id/events", runGuard(deps.db), (c) => streamRunEvents(c, deps.db, c.get("run").id));

  return routes;
}
