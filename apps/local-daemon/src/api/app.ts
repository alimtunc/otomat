import { CORRELATION_ID_HEADER } from "@otomat/domain";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";

import { correlatedRequestLog, DiagnosticLogRing, recordThrownFailure } from "#diagnostics";
import { WorktreeConflictError } from "#git";
import { TerminalRefusedError } from "#terminal";

import type { ApiDeps } from "./deps.js";
import { jsonCompression } from "./json-compression.js";
import { launchRefusalResponse } from "./launch-refusal.js";
import { createActivityRoutes } from "./routes/activity.js";
import { createAgentProfileRoutes } from "./routes/agent-profiles.js";
import { createCatalogRoutes } from "./routes/catalog.js";
import { createCompeteRoutes } from "./routes/compete.js";
import { createConversationRoutes } from "./routes/conversations.js";
import { createDiagnosticsRoutes } from "./routes/diagnostics.js";
import { createGitHubRoutes } from "./routes/github.js";
import { createHealthRoutes } from "./routes/health.js";
import { createInboxRoutes } from "./routes/inbox.js";
import { createIssueRoutes } from "./routes/issues.js";
import { createLinearRoutes } from "./routes/linear.js";
import { createProjectHealthRoutes } from "./routes/project-health.js";
import { createPullRequestRoutes } from "./routes/pull-requests.js";
import { createRepositoryRoutes } from "./routes/repositories.js";
import { createRepositoryFileRoutes } from "./routes/repository-files.js";
import { createReviewRoutes } from "./routes/review.js";
import { createReviewInboxRoutes } from "./routes/reviews.js";
import { createRunContributionRoutes } from "./routes/run/contributions.js";
import { createRunEventRoutes } from "./routes/run/events.js";
import { createRunFileRoutes } from "./routes/run/files.js";
import { createRunInteractionRoutes } from "./routes/run/interactions.js";
import { createRunStepRoutes } from "./routes/run/steps.js";
import { createRunWorkspaceRoutes } from "./routes/run/workspace.js";
import { createRunRoutes } from "./routes/runs.js";
import { createSettingsRoutes } from "./routes/settings.js";
import { createSkillRoutes } from "./routes/skills.js";
import { createSourceControlRoutes } from "./routes/source-control.js";
import { createTerminalRoutes } from "./routes/terminals.js";
import { createUsageRoutes } from "./routes/usage.js";
import { createWorkflowPresetRoutes } from "./routes/workflow-presets.js";
import { createWorkspaceRoutes } from "./routes/workspaces.js";
import {
  allowedOrigin,
  hostGuard,
  refuseForeignMutations,
  requireDaemonToken,
} from "./security.js";

// The bearer header preflights every renderer GET; Chromium caps the cache at two hours.
const PREFLIGHT_MAX_AGE_SECONDS = 7200;

/** CORS runs before the origin and token guards so it answers preflights and keeps their refusals readable. */
export function createApiApp(deps: ApiDeps): Hono {
  const app = new Hono();
  const diagnosticLog = new DiagnosticLogRing();
  const allowOrigin = allowedOrigin();

  app.use("/api/*", hostGuard());
  app.use(
    "/api/*",
    cors({
      origin: allowOrigin,
      exposeHeaders: [CORRELATION_ID_HEADER],
      maxAge: PREFLIGHT_MAX_AGE_SECONDS,
    }),
  );
  app.use("/api/*", refuseForeignMutations(allowOrigin));
  app.use("/api/*", requireDaemonToken(deps.token));
  app.use("/api/*", correlatedRequestLog(diagnosticLog));
  app.use("/api/*", ...jsonCompression);

  app.route("/api", createHealthRoutes(deps));
  app.route("/api", createDiagnosticsRoutes(diagnosticLog));
  app.route("/api", createGitHubRoutes(deps));
  app.route("/api", createCatalogRoutes(deps));
  app.route("/api/activity", createActivityRoutes(deps));
  app.route("/api/conversations", createConversationRoutes(deps));
  app.route("/api/inbox", createInboxRoutes(deps));
  app.route("/api/linear", createLinearRoutes(deps));
  app.route("/api/settings", createSettingsRoutes(deps));
  app.route("/api/projects", createProjectHealthRoutes(deps));
  app.route("/api/repositories", createRepositoryRoutes(deps));
  app.route("/api/repositories", createRepositoryFileRoutes(deps));
  app.route("/api/source-control", createSourceControlRoutes(deps));
  app.route("/api/agent-profiles", createAgentProfileRoutes(deps));
  app.route("/api/skills", createSkillRoutes(deps));
  app.route("/api/workflow-presets", createWorkflowPresetRoutes(deps));
  app.route("/api/workspaces", createWorkspaceRoutes(deps));
  app.route("/api/terminals", createTerminalRoutes(deps));
  app.route("/api/issues", createIssueRoutes(deps));
  app.route("/api/usage", createUsageRoutes(deps));
  app.route("/api/pull-requests", createPullRequestRoutes(deps));
  app.route("/api/reviews", createReviewInboxRoutes(deps));
  app.route("/api/runs", createRunContributionRoutes(deps));
  app.route("/api/runs", createRunEventRoutes(deps));
  app.route("/api/runs", createRunFileRoutes(deps));
  app.route("/api/runs", createRunInteractionRoutes(deps));
  app.route("/api/runs", createRunStepRoutes(deps));
  app.route("/api/runs", createRunWorkspaceRoutes(deps));
  app.route("/api/runs", createRunRoutes(deps));
  app.route("/api/runs", createCompeteRoutes(deps));
  app.route("/api/runs", createReviewRoutes(deps));

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    const launchRefusal = launchRefusalResponse(c, err);
    if (launchRefusal) return launchRefusal;
    if (err instanceof WorktreeConflictError) {
      return c.json({ error: "worktree_conflict", message: err.message }, 409);
    }
    if (err instanceof TerminalRefusedError) {
      return c.json({ error: "terminal_refused", message: err.message }, 409);
    }
    console.error("[otomat] api error", err);
    recordThrownFailure(diagnosticLog, c, err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}

/** Prints the registered method+path table. Dev aid — call from the daemon behind a flag. */
export function logApiRoutes(app: Hono): void {
  showRoutes(app, { verbose: true });
}
