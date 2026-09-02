import {
  runDiffScopeParams,
  BRANCH_DIFF_SCOPE,
  type ExecutionHostId,
  type ReviewTarget,
  type RunDiffScopeSelector,
  type UsageFilters,
} from "@otomat/domain";

function runDiffScopeKey(scope: RunDiffScopeSelector): string {
  const params = runDiffScopeParams(scope);
  return `${params.scope ?? "branch"}:${params.commit ?? params.step ?? params.session ?? ""}`;
}

/**
 * Every daemon-backed key starts with the host that answered, so two daemons' caches never collide
 * and a host switch re-keys observers instead of clearing them. Keys nest so a parent invalidation
 * cascades by prefix; `run` (single) and `runs` (list) are distinct roots.
 */
export function hostKeys(host: ExecutionHostId) {
  return {
    host: [host] as const,
    health: [host, "health"] as const,
    activity: [host, "activity"] as const,
    inbox: [host, "inbox"] as const,
    daemonLogExcerpt: (correlationId: string | null) =>
      [host, "diagnostics", "logs", correlationId] as const,
    githubConnection: [host, "github", "connection"] as const,
    linear: [host, "linear"] as const,
    linearConnections: [host, "linear", "connections"] as const,
    issueSources: [host, "linear", "sources"] as const,
    linearWorkspaceFor: (connectionId: string | null) =>
      [host, "linear", "workspace", connectionId] as const,
    issueSourcesFor: (projectId?: string) =>
      [host, "linear", "sources", projectId ?? null] as const,
    linearSyncStatus: (projectId: string) => [host, "linear", "sync-status", projectId] as const,
    linearSync: (projectId: string) => [host, "linear", "sync", projectId] as const,
    projects: [host, "projects"] as const,
    repositories: [host, "repositories"] as const,
    repositoriesFor: (projectId?: string) =>
      [host, "repositories", "project", projectId ?? null] as const,
    repositoryBranches: (repositoryId: string | null) =>
      [host, "repositories", repositoryId, "branches"] as const,
    repositoryFiles: (repositoryId: string | null, query: string) =>
      [host, "repositories", repositoryId, "files", query] as const,
    runtimes: [host, "runtimes"] as const,
    runtimeModels: (runtimeId: string | null) => [host, "runtimes", runtimeId, "models"] as const,
    runtimeOptions: (runtimeId: string | null, model: string | null) =>
      [host, "runtimes", runtimeId, "options", model] as const,
    executionDefaults: [host, "settings", "execution-defaults"] as const,
    pullRequestGenerator: [host, "settings", "pr-generator"] as const,
    agentProfiles: [host, "agent-profiles"] as const,
    agentProfilesFor: (projectId?: string) =>
      [host, "agent-profiles", "project", projectId ?? null] as const,
    skills: [host, "skills"] as const,
    workflowPresets: [host, "workflow-presets"] as const,
    workflowPresetsFor: (projectId?: string) =>
      [host, "workflow-presets", "project", projectId ?? null] as const,
    issues: [host, "issues"] as const,
    issuesList: (projectId?: string) => [host, "issues", "project", projectId ?? null] as const,
    issue: (id: string) => [host, "issues", id] as const,
    linearWriteback: (issueId: string) => [host, "linear", "writeback", issueId] as const,
    linearEditor: (issueId: string) => [host, "linear", "editor", issueId] as const,
    linearComments: (issueId: string) => [host, "linear", "comments", issueId] as const,
    usage: [host, "usage"] as const,
    usageDashboard: (filters: UsageFilters) => [host, "usage", filters] as const,
    runs: [host, "runs"] as const,
    runsList: (projectId?: string) => [host, "runs", "project", projectId ?? null] as const,
    runsForIssue: (issueId: string) => [host, "runs", { issueId }] as const,
    run: (id: string) => [host, "run", id] as const,
    runEventWindow: (id: string) => [host, "run-events", id] as const,
    stepEventWindow: (id: string, stepId: string) =>
      [host, "run-events", id, "step", stepId] as const,
    runCompletionReport: (id: string) => [host, "run", id, "report"] as const,
    runUsage: (id: string) => [host, "run", id, "usage"] as const,
    runCommits: (id: string) => [host, "run", id, "commits"] as const,
    runContributions: (id: string) => [host, "run", id, "contributions"] as const,
    runInteractions: (id: string) => [host, "run", id, "interactions"] as const,
    sessionContext: (runId: string, agentSessionId: string) =>
      [host, "run", runId, "session", agentSessionId, "context"] as const,
    reviewDiff: (target: ReviewTarget, scope: RunDiffScopeSelector = BRANCH_DIFF_SCOPE) =>
      [host, "review", target.kind, target.id, "diff", runDiffScopeKey(scope)] as const,
    reviewDiffFileBlobs: (
      target: ReviewTarget,
      path: string,
      sha: string,
      scope: RunDiffScopeSelector = BRANCH_DIFF_SCOPE,
    ) =>
      [
        host,
        "review",
        target.kind,
        target.id,
        "diff",
        runDiffScopeKey(scope),
        "file",
        path,
        sha,
      ] as const,
    commentFixProof: (id: string, commentId: string) =>
      [host, "run", id, "fix-proof", commentId] as const,
    runWorkspace: (id: string) => [host, "run", id, "workspace"] as const,
    competeCandidateDiff: (runId: string, groupId: string, stepId: string) =>
      [host, "run", runId, "compete", groupId, stepId, "diff"] as const,
    reviewDetail: (target: ReviewTarget) =>
      [host, "review", target.kind, target.id, "detail"] as const,
    runPullRequest: (id: string) => [host, "run", id, "pr"] as const,
    issuePullRequests: (issueId: string) => [host, "issues", issueId, "pull-requests"] as const,
    pullRequest: (id: string) => [host, "pull-request", id] as const,
    pullRequestOverview: (id: string) => [host, "pull-request", id, "overview"] as const,
    pullRequestMerge: (id: string) => [host, "pull-request", id, "merge"] as const,
    pullRequestRefresh: (id: string) => [host, "pull-request", id, "refresh"] as const,
    workspaces: [host, "workspaces"] as const,
    workspacesForProject: (projectId?: string) =>
      [host, "workspaces", "project", projectId ?? null] as const,
    workspacesForRun: (runId: string | null) => [host, "workspaces", "run", runId] as const,
    workspaceSettings: (projectId: string) => [host, "settings", "workspaces", projectId] as const,
    reviews: [host, "reviews"] as const,
    pullRequestInbox: (projectId?: string) =>
      [host, "reviews", "project", projectId ?? null] as const,
    pullRequestInboxSync: (projectId: string) => [host, "reviews", "sync", projectId] as const,
  };
}

export type HostQueryKeys = ReturnType<typeof hostKeys>;

/** Answered by the desktop shell about every host at once, so these carry no host of their own. */
export const shellKeys = {
  executionHost: ["execution-host"] as const,
  hostProjects: ["execution-host", "projects"] as const,
  hostRepositories: ["execution-host", "repositories"] as const,
  // A separate root on purpose: a host status push invalidates the snapshot, never the ssh config read.
  executionHostAliases: ["execution-host-aliases"] as const,
  desktopUpdate: ["desktop-update"] as const,
};
