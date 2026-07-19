import { CompeteWinnerConflictError, getCompeteGroup, getStepRun } from "@otomat/db";
import {
  followUpRunRequestSchema,
  selectCompeteWinnerRequestSchema,
  startRunRequestSchema,
} from "@otomat/domain";
import { Hono } from "hono";

import { RuntimeUnavailableError, UnknownRuntimeError } from "#runtime";
import { ProjectNotFoundError, RunNotResumableError } from "#supervisor";

import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { readRunDetail, readRuns } from "../reads.js";
import { toRun, toRunDiffResponse } from "../serialize.js";
import { streamRunEvents } from "../sse.js";

/** Mounted at `/api/runs`. Holds the run reads, the run commands (start/resume/abort), and the SSE stream. */
export function createRunRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

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
      const run = await deps.launchRun(c.req.valid("json"));
      return c.json(toRun(run), 201);
    } catch (error) {
      if (error instanceof UnknownRuntimeError) {
        return c.json({ error: "unknown_runtime" }, 400);
      }
      if (error instanceof ProjectNotFoundError) {
        return c.json({ error: "project_not_found" }, 400);
      }
      if (error instanceof RuntimeUnavailableError) {
        return c.json(
          { error: "runtime_unavailable", runtime: error.runtime, reason: error.reason },
          409,
        );
      }
      console.error("[otomat] launch run failed", error);
      return c.json({ error: "run_launch_failed" }, 500);
    }
  });

  routes.get("/:id", (c) => {
    const detail = readRunDetail(deps.db, c.req.param("id"));
    return detail ? c.json(detail) : c.json({ error: "run_not_found" }, 404);
  });

  routes.post("/:id/resume", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      return c.json(toRun(await deps.resumeRun(run.id)));
    } catch (error) {
      if (error instanceof RunNotResumableError) {
        return c.json({ error: "run_not_resumable" }, 409);
      }
      console.error(`[otomat] resume run ${run.id} failed`, error);
      return c.json({ error: "run_resume_failed" }, 500);
    }
  });

  routes.post(
    "/:id/follow-up",
    validateJson(followUpRunRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      try {
        return c.json(toRun(await deps.followUpRun(run.id, c.req.valid("json").prompt)));
      } catch (error) {
        if (error instanceof RunNotResumableError) {
          return c.json({ error: "run_not_resumable" }, 409);
        }
        console.error(`[otomat] follow-up on run ${run.id} failed`, error);
        return c.json({ error: "run_follow_up_failed" }, 500);
      }
    },
  );

  routes.get("/:id/compete-groups/:groupId/candidates/:stepId/diff", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const group = getCompeteGroup(deps.db, c.req.param("groupId"));
    const step = getStepRun(deps.db, c.req.param("stepId"));
    if (!group || group.run_id !== run.id || !step || step.compete_group_id !== group.id) {
      return c.json({ error: "compete_candidate_not_found" }, 404);
    }
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
        await deps.selectCompeteWinner(
          run.id,
          c.req.param("groupId"),
          c.req.valid("json").step_run_id,
        );
        const detail = readRunDetail(deps.db, run.id);
        return detail ? c.json(detail) : c.json({ error: "run_not_found" }, 404);
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
      await deps.abortRun(run.id);
    } catch (error) {
      console.error(`[otomat] abort run ${run.id} failed`, error);
      return c.json({ error: "run_abort_failed" }, 500);
    }
    const detail = readRunDetail(deps.db, run.id);
    return detail ? c.json(detail) : c.json({ error: "run_not_found" }, 404);
  });

  routes.get("/:id/events", runGuard(deps.db), (c) => streamRunEvents(c, deps.db, c.get("run").id));

  return routes;
}
