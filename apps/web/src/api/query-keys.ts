import {
  runDiffScopeParams,
  WORKSPACE_DIFF_SCOPE,
  type ReviewTarget,
  type RunDiffScopeSelector,
  type UsageFilters,
} from "@otomat/domain";

function runDiffScopeKey(scope: RunDiffScopeSelector): string {
  const params = runDiffScopeParams(scope);
  return `${params.scope ?? "workspace"}:${params.commit ?? params.step ?? params.session ?? ""}`;
}

/** Keys nest so a parent invalidation cascades by prefix; `run` (single) and `runs` (list) are distinct roots. */
export const queryKeys = {
  health: ["health"] as const,
  activity: ["activity"] as const,
  inbox: ["inbox"] as const,
  daemonLogExcerpt: (correlationId: string | null) =>
    ["diagnostics", "logs", correlationId] as const,
  githubConnection: ["github", "connection"] as const,
  linear: ["linear"] as const,
  linearConnection: ["linear", "connection"] as const,
  issueSources: ["linear", "sources"] as const,
  linearWorkspaceFor: (workspaceId: string | null) => ["linear", "workspace", workspaceId] as const,
  issueSourcesFor: (workspaceId: string | null, projectId?: string) =>
    ["linear", "sources", workspaceId, projectId ?? null] as const,
  linearSyncStatus: (projectId: string) => ["linear", "sync-status", projectId] as const,
  linearSync: (projectId: string) => ["linear", "sync", projectId] as const,
  projects: ["projects"] as const,
  repositories: ["repositories"] as const,
  repositoriesFor: (projectId?: string) => ["repositories", "project", projectId ?? null] as const,
  repositoryBranches: (repositoryId: string | null) =>
    ["repositories", repositoryId, "branches"] as const,
  repositoryFiles: (repositoryId: string | null, query: string) =>
    ["repositories", repositoryId, "files", query] as const,
  runtimes: ["runtimes"] as const,
  runtimeModels: (runtimeId: string | null) => ["runtimes", runtimeId, "models"] as const,
  runtimeOptions: (runtimeId: string | null, model: string | null) =>
    ["runtimes", runtimeId, "options", model] as const,
  executionDefaults: ["settings", "execution-defaults"] as const,
  pullRequestGenerator: ["settings", "pr-generator"] as const,
  executionHost: ["execution-host"] as const,
  hostProjects: ["execution-host", "projects"] as const,
  hostRepositories: ["execution-host", "repositories"] as const,
  // A separate root on purpose: a host status push invalidates the snapshot, never the ssh config read.
  executionHostAliases: ["execution-host-aliases"] as const,
  agentProfiles: ["agent-profiles"] as const,
  skills: ["skills"] as const,
  workflowPresets: ["workflow-presets"] as const,
  workflowPresetsFor: (projectId?: string) =>
    ["workflow-presets", "project", projectId ?? null] as const,
  issues: ["issues"] as const,
  issuesList: (projectId?: string) => ["issues", "project", projectId ?? null] as const,
  issue: (id: string) => ["issues", id] as const,
  linearWriteback: (issueId: string) => ["linear", "writeback", issueId] as const,
  linearEditor: (issueId: string) => ["linear", "editor", issueId] as const,
  linearComments: (issueId: string) => ["linear", "comments", issueId] as const,
  usage: ["usage"] as const,
  usageDashboard: (filters: UsageFilters) => ["usage", filters] as const,
  runs: ["runs"] as const,
  runsList: (projectId?: string) => ["runs", "project", projectId ?? null] as const,
  runsForIssue: (issueId: string) => ["runs", { issueId }] as const,
  run: (id: string) => ["run", id] as const,
  runEventWindow: (id: string) => ["run-events", id] as const,
  stepEventWindow: (id: string, stepId: string) => ["run-events", id, "step", stepId] as const,
  runCompletionReport: (id: string) => ["run", id, "report"] as const,
  runUsage: (id: string) => ["run", id, "usage"] as const,
  runCommits: (id: string) => ["run", id, "commits"] as const,
  runContributions: (id: string) => ["run", id, "contributions"] as const,
  sessionContext: (runId: string, agentSessionId: string) =>
    ["run", runId, "session", agentSessionId, "context"] as const,
  reviewDiff: (target: ReviewTarget, scope: RunDiffScopeSelector = WORKSPACE_DIFF_SCOPE) =>
    ["review", target.kind, target.id, "diff", runDiffScopeKey(scope)] as const,
  reviewDiffFileBlobs: (
    target: ReviewTarget,
    path: string,
    sha: string,
    scope: RunDiffScopeSelector = WORKSPACE_DIFF_SCOPE,
  ) =>
    ["review", target.kind, target.id, "diff", runDiffScopeKey(scope), "file", path, sha] as const,
  commentFixProof: (id: string, commentId: string) => ["run", id, "fix-proof", commentId] as const,
  runWorkspace: (id: string) => ["run", id, "workspace"] as const,
  competeCandidateDiff: (runId: string, groupId: string, stepId: string) =>
    ["run", runId, "compete", groupId, stepId, "diff"] as const,
  reviewDetail: (target: ReviewTarget) => ["review", target.kind, target.id, "detail"] as const,
  runPullRequest: (id: string) => ["run", id, "pr"] as const,
  issuePullRequests: (issueId: string) => ["issues", issueId, "pull-requests"] as const,
  pullRequest: (id: string) => ["pull-request", id] as const,
  pullRequestRefresh: (id: string) => ["pull-request", id, "refresh"] as const,
  workspaces: ["workspaces"] as const,
  workspacesForRun: (runId: string | null) => ["workspaces", "run", runId] as const,
  workspaceSettings: ["settings", "workspaces"] as const,
  reviews: ["reviews"] as const,
  pullRequestInbox: (projectId?: string) => ["reviews", "project", projectId ?? null] as const,
  pullRequestInboxSync: (projectId: string) => ["reviews", "sync", projectId] as const,
};
