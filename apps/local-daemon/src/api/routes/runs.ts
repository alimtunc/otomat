import { getPullRequestForRun, getRun, listAgentSessionsForRun } from "@otomat/db";
import {
  appendRunStepRequestSchema,
  appendedRunStepResponseSchema,
  executableSteps,
  IllegalTransitionError,
  scheduleProviderResumeRequestSchema,
  startRunRequestSchema,
  type RunLaunchError,
  type SessionContextResponse,
} from "@otomat/domain";
import { Hono } from "hono";

import {
  LaunchRefusedError,
  ProviderResumeRefusedError,
  RunNotResumableError,
  WorkspaceAbandonRefusedError,
} from "#supervisor";

import { agentConfigErrorResponse } from "../agent-config-refusal.js";
import { projectRunCompletionReport } from "../completion-report.js";
import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { toPullRequest } from "../pull-request-serialize.js";
import { readRunUsage, readRuns } from "../reads.js";
import { refusalJson } from "../refusal.js";
import { runDetailJson } from "../run-detail.js";
import { runtimeUnavailableResponse } from "../runtime-unavailable.js";
import { toRun } from "../serialize.js";
import { appendStepSelector, stepAppendErrorResponse } from "../step-append.js";

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
} satisfies Record<RunLaunchError, 400 | 409>;

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
      const launched = await deps.supervisor.start(c.req.valid("json"));
      // Re-read with the wait in the same tick, so the status and the reason it is queued agree.
      const run = getRun(deps.db, launched.id) ?? launched;
      return c.json({ run: toRun(run), wait: deps.supervisor.waitFor(run.id) }, 201);
    } catch (error) {
      if (error instanceof LaunchRefusedError) {
        const status = LAUNCH_REFUSAL_STATUS[error.code];
        return c.json({ error: error.code, message: error.message, run_id: error.runId }, status);
      }
      const runtimeRefusal = runtimeUnavailableResponse(c, error);
      if (runtimeRefusal) return runtimeRefusal;
      const refusal = agentConfigErrorResponse(error);
      if (refusal) return refusalJson(c, refusal);
      console.error("[otomat] launch run failed", error);
      return c.json({ error: "run_launch_failed" }, 500);
    }
  });

  routes.get("/:id", (c) => runDetailJson(deps, c, c.req.param("id")));

  routes.get("/:id/usage", runGuard(deps.db), (c) => c.json(readRunUsage(deps.db, c.get("run"))));

  routes.get("/:id/report", (c) => {
    const report = projectRunCompletionReport(deps.db, c.req.param("id"), deps.review);
    return report ? c.json(report) : c.json({ error: "run_not_found" }, 404);
  });

  routes.post("/:id/resume", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      return c.json(toRun(await deps.supervisor.resume(run.id)));
    } catch (error) {
      if (error instanceof LaunchRefusedError) {
        return c.json({ error: error.code, message: error.message }, 409);
      }
      if (error instanceof RunNotResumableError) {
        return c.json({ error: "run_not_resumable", message: error.message }, 409);
      }
      const runtimeRefusal = runtimeUnavailableResponse(c, error);
      if (runtimeRefusal) return runtimeRefusal;
      if (error instanceof IllegalTransitionError && error.machine === "issue") {
        return c.json({ error: "issue_closed", message: error.message }, 409);
      }
      console.error(`[otomat] resume run ${run.id} failed`, error);
      return c.json({ error: "run_resume_failed" }, 500);
    }
  });

  routes.post(
    "/:id/provider-wait",
    validateJson(scheduleProviderResumeRequestSchema),
    runGuard(deps.db),
    (c) => {
      const run = c.get("run");
      try {
        deps.supervisor.scheduleProviderResume(run.id, c.req.valid("json").resume_at);
      } catch (error) {
        if (error instanceof ProviderResumeRefusedError) {
          return c.json({ error: error.code, message: error.message }, 409);
        }
        console.error(`[otomat] scheduling the provider resume of run ${run.id} failed`, error);
        return c.json({ error: "provider_resume_schedule_failed" }, 500);
      }
      return runDetailJson(deps, c, run.id);
    },
  );

  routes.get("/:id/workspace", runGuard(deps.db), (c) => {
    const run = c.get("run");
    try {
      const facts = deps.supervisor.workspaceClosure(run.id);
      if (!facts) return c.json({ error: "run_not_found" }, 404);
      const pullRequest = getPullRequestForRun(deps.db, run.id);
      return c.json({
        ...facts,
        pull_request: pullRequest ? toPullRequest(pullRequest) : null,
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
          note: request.note ?? null,
          references: request.context ?? [],
          selector: appendStepSelector(request),
          overrides: { model: request.model, options: request.options },
          dependsOn: request.depends_on,
          replaces: request.replaces ?? null,
          origin: "user",
        });
        const step = executableSteps(updated.plan_json).at(-1);
        if (!step) throw new Error(`run ${run.id} has no appended step`);
        return c.json(
          appendedRunStepResponseSchema.parse({ run: toRun(updated), step_run_id: step.id }),
          201,
        );
      } catch (error) {
        const refusal = stepAppendErrorResponse(c, error);
        if (refusal) return refusal;
        console.error(`[otomat] appending a step to run ${run.id} failed`, error);
        return c.json({ error: "step_append_failed" }, 500);
      }
    },
  );

  /** The dossier one session was given, so what an agent received stays readable after the turn. */
  routes.get("/:id/sessions/:sessionId/context", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const sessionId = c.req.param("sessionId");
    const session = listAgentSessionsForRun(deps.db, run.id).find((row) => row.id === sessionId);
    if (!session) return c.json({ error: "agent_session_not_found" }, 404);
    return c.json({
      run_id: run.id,
      agent_session_id: sessionId,
      context: session.context_json ?? null,
    } satisfies SessionContextResponse);
  });

  routes.post("/:id/abort", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      await deps.supervisor.abort(run.id);
    } catch (error) {
      console.error(`[otomat] abort run ${run.id} failed`, error);
      return c.json({ error: "run_abort_failed" }, 500);
    }
    return runDetailJson(deps, c, run.id);
  });

  return routes;
}
