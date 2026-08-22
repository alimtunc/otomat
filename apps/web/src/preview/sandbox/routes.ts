import {
  EMPTY_EXECUTION_DEFAULTS,
  type LinearSyncStatusContract,
  type LinearWorkspaceContract,
} from "@otomat/domain";
import { SANDBOX_ACTIVITY } from "@web/preview/sandbox/activity";
import {
  SANDBOX_GITHUB,
  SANDBOX_LINEAR,
  SANDBOX_PROFILES,
  SANDBOX_RUNTIMES,
  sandboxModels,
  sandboxOptions,
} from "@web/preview/sandbox/catalog";
import { SANDBOX_INBOX } from "@web/preview/sandbox/inbox";
import { SANDBOX_ISSUES, sandboxIssue } from "@web/preview/sandbox/issues";
import {
  SANDBOX_DIFF,
  SANDBOX_DIFF_BLOBS,
  SANDBOX_PULL_REQUEST_DETAIL,
  SANDBOX_PULL_REQUESTS,
  SANDBOX_REVIEW,
  SANDBOX_REVIEW_INBOX,
} from "@web/preview/sandbox/review";
import {
  SANDBOX_RUNS,
  sandboxEventWindow,
  sandboxRunCommits,
  sandboxRunContributions,
  sandboxRunDetail,
  sandboxRunUsage,
  sandboxRunWorkspace,
} from "@web/preview/sandbox/runs";
import {
  SANDBOX_BRANCHES,
  SANDBOX_CAPACITY,
  SANDBOX_PROJECT,
  SANDBOX_PROJECT_ID,
  SANDBOX_REPOSITORY,
  SANDBOX_WORKSPACE_SETTINGS,
  SANDBOX_WORKSPACES,
  sandboxHealth,
} from "@web/preview/sandbox/workspace";

interface SandboxRoute {
  pattern: RegExp;
  respond(match: RegExpExecArray, build: string): Response;
}

function json(body: unknown): Response {
  return Response.json(body);
}

/** A read the sandbox has no fixture for, said as itself: never a daemon 404, never an empty list. */
function unsupported(path: string): Response {
  return Response.json(
    {
      error: "sandbox_unsupported",
      message: `The preview sandbox serves no fixture for ${path}; open the full preview to read it.`,
    },
    { status: 501 },
  );
}

/** A fixture the sandbox knows the route for but not the id: a 404, so the typed client raises rather than parsing an error body as a contract. */
function notFound(path: string): Response {
  return Response.json(
    { error: "not_found", message: `The preview sandbox holds no fixture at ${path}.` },
    { status: 404 },
  );
}

const LINEAR_WORKSPACE: LinearWorkspaceContract = { teams: [], projects: [] };

const LINEAR_SYNC: LinearSyncStatusContract = {
  project_id: SANDBOX_PROJECT_ID,
  sources: 0,
  running: false,
  last_synced_at: null,
  last_result: null,
  last_error: null,
};

const ROUTES: SandboxRoute[] = [
  { pattern: /^\/api\/health$/, respond: (_m, build) => json(sandboxHealth(build)) },
  { pattern: /^\/api\/activity$/, respond: () => json(SANDBOX_ACTIVITY) },
  { pattern: /^\/api\/inbox$/, respond: () => json(SANDBOX_INBOX) },
  { pattern: /^\/api\/projects$/, respond: () => json([SANDBOX_PROJECT]) },
  { pattern: /^\/api\/repositories$/, respond: () => json([SANDBOX_REPOSITORY]) },
  { pattern: /^\/api\/repositories\/[^/]+\/branches$/, respond: () => json(SANDBOX_BRANCHES) },
  { pattern: /^\/api\/repositories\/[^/]+\/files$/, respond: () => json([]) },
  { pattern: /^\/api\/settings\/capacity$/, respond: () => json(SANDBOX_CAPACITY) },
  {
    pattern: /^\/api\/settings\/(execution-defaults|pr-generator)$/,
    respond: () => json(EMPTY_EXECUTION_DEFAULTS),
  },
  { pattern: /^\/api\/settings\/workspaces$/, respond: () => json(SANDBOX_WORKSPACE_SETTINGS) },
  { pattern: /^\/api\/workspaces$/, respond: () => json(SANDBOX_WORKSPACES) },
  { pattern: /^\/api\/runtimes$/, respond: () => json(SANDBOX_RUNTIMES) },
  {
    pattern: /^\/api\/runtimes\/([^/]+)\/models$/,
    respond: (m) => json(sandboxModels(m[1] ?? "")),
  },
  {
    pattern: /^\/api\/runtimes\/([^/]+)\/options$/,
    respond: (m) => json(sandboxOptions(m[1] ?? "")),
  },
  { pattern: /^\/api\/agent-profiles$/, respond: () => json(SANDBOX_PROFILES) },
  { pattern: /^\/api\/skills$/, respond: () => json([]) },
  { pattern: /^\/api\/workflow-presets$/, respond: () => json([]) },
  { pattern: /^\/api\/github\/connection$/, respond: () => json(SANDBOX_GITHUB) },
  { pattern: /^\/api\/linear\/connection$/, respond: () => json(SANDBOX_LINEAR) },
  { pattern: /^\/api\/linear\/workspace$/, respond: () => json(LINEAR_WORKSPACE) },
  { pattern: /^\/api\/linear\/sources$/, respond: () => json([]) },
  { pattern: /^\/api\/linear\/sync-status$/, respond: () => json(LINEAR_SYNC) },
  { pattern: /^\/api\/issues$/, respond: () => json(SANDBOX_ISSUES) },
  {
    pattern: /^\/api\/issues\/([^/]+)$/,
    respond: (m) => {
      const issue = sandboxIssue(m[1] ?? "");
      return issue === null ? notFound(m[0]) : json(issue);
    },
  },
  { pattern: /^\/api\/issues\/[^/]+\/pull-requests$/, respond: () => json(SANDBOX_PULL_REQUESTS) },
  { pattern: /^\/api\/reviews$/, respond: () => json(SANDBOX_REVIEW_INBOX) },
  { pattern: /^\/api\/pull-requests\/[^/]+$/, respond: () => json(SANDBOX_PULL_REQUESTS[0]) },
  { pattern: /^\/api\/runs$/, respond: () => json(SANDBOX_RUNS) },
  {
    pattern: /^\/api\/runs\/([^/]+)$/,
    respond: (m) => {
      const detail = sandboxRunDetail(m[1] ?? "");
      return detail === null ? notFound(m[0]) : json(detail);
    },
  },
  {
    pattern: /^\/api\/runs\/([^/]+)\/events\/window$/,
    respond: (m) => json(sandboxEventWindow(m[1] ?? "")),
  },
  { pattern: /^\/api\/runs\/([^/]+)\/usage$/, respond: (m) => json(sandboxRunUsage(m[1] ?? "")) },
  {
    pattern: /^\/api\/runs\/([^/]+)\/commits$/,
    respond: (m) => json(sandboxRunCommits(m[1] ?? "")),
  },
  {
    pattern: /^\/api\/runs\/([^/]+)\/contributions$/,
    respond: (m) => json(sandboxRunContributions(m[1] ?? "")),
  },
  {
    pattern: /^\/api\/runs\/([^/]+)\/workspace$/,
    respond: (m) => json(sandboxRunWorkspace(m[1] ?? "")),
  },
  { pattern: /^\/api\/runs\/[^/]+\/pr$/, respond: () => json(SANDBOX_PULL_REQUEST_DETAIL) },
  { pattern: /^\/api\/(runs|pull-requests)\/[^/]+\/diff$/, respond: () => json(SANDBOX_DIFF) },
  {
    pattern: /^\/api\/(runs|pull-requests)\/[^/]+\/diff\/file$/,
    respond: () => json(SANDBOX_DIFF_BLOBS),
  },
  { pattern: /^\/api\/(runs|pull-requests)\/[^/]+\/review$/, respond: () => json(SANDBOX_REVIEW) },
];

export function sandboxRead(path: string, build: string): Response {
  for (const route of ROUTES) {
    const match = route.pattern.exec(path);
    if (match !== null) return route.respond(match, build);
  }
  return unsupported(path);
}
