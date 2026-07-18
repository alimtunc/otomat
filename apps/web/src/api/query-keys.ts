/**
 * Query-key factory. Keys nest so a parent invalidation cascades to children
 * (TanStack matches by prefix): invalidating `run(id)` also clears that run's
 * `runDiff`/`runReview`/`runPullRequest`, and invalidating `runs` also clears
 * every `runsForIssue`. Note `run` (single) and `runs` (list) are distinct roots.
 */
export const queryKeys = {
  health: ["health"] as const,
  githubConnection: ["github", "connection"] as const,
  projects: ["projects"] as const,
  repositories: ["repositories"] as const,
  runtimes: ["runtimes"] as const,
  issues: ["issues"] as const,
  issuesList: (projectId?: string) => ["issues", "list", { projectId: projectId ?? null }] as const,
  issue: (id: string) => ["issues", id] as const,
  runs: ["runs"] as const,
  runsList: (projectId?: string) => ["runs", "list", { projectId: projectId ?? null }] as const,
  runsForIssue: (issueId: string) => ["runs", { issueId }] as const,
  run: (id: string) => ["run", id] as const,
  runDiff: (id: string) => ["run", id, "diff"] as const,
  runReview: (id: string) => ["run", id, "review"] as const,
  runPullRequest: (id: string) => ["run", id, "pr"] as const,
};
