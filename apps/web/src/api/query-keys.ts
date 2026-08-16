/**
 * Query-key factory. Keys nest so a parent invalidation cascades to children
 * (TanStack matches by prefix): invalidating `run(id)` also clears that run's
 * `runDiff`/`runReview`/`runPullRequest`, and invalidating `runs` also clears
 * every `runsForIssue`. Note `run` (single) and `runs` (list) are distinct roots.
 */
export const queryKeys = {
  health: ["health"] as const,
  daemonLogExcerpt: (correlationId: string | null) =>
    ["diagnostics", "logs", correlationId] as const,
  githubConnection: ["github", "connection"] as const,
  linear: ["linear"] as const,
  linearConnection: ["linear", "connection"] as const,
  issueSources: ["linear", "sources"] as const,
  linearWorkspaceFor: (workspaceId: string | null) => ["linear", "workspace", workspaceId] as const,
  issueSourcesFor: (workspaceId: string | null) => ["linear", "sources", workspaceId] as const,
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
  runs: ["runs"] as const,
  runsList: (projectId?: string) => ["runs", "project", projectId ?? null] as const,
  runsForIssue: (issueId: string) => ["runs", { issueId }] as const,
  run: (id: string) => ["run", id] as const,
  runEventWindow: (id: string) => ["run-events", id] as const,
  runCompletionReport: (id: string) => ["run", id, "report"] as const,
  runContributions: (id: string) => ["run", id, "contributions"] as const,
  sessionContext: (runId: string, agentSessionId: string) =>
    ["run", runId, "session", agentSessionId, "context"] as const,
  runDiff: (id: string) => ["run", id, "diff"] as const,
  runDiffFileBlobs: (id: string, path: string, sha: string) =>
    ["run", id, "diff", "file", path, sha] as const,
  runWorkspace: (id: string) => ["run", id, "workspace"] as const,
  competeCandidateDiff: (runId: string, groupId: string, stepId: string) =>
    ["run", runId, "compete", groupId, stepId, "diff"] as const,
  runReview: (id: string) => ["run", id, "review"] as const,
  runPullRequest: (id: string) => ["run", id, "pr"] as const,
};
