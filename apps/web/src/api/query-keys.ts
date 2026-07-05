export const queryKeys = {
  health: ["health"] as const,
  projects: ["projects"] as const,
  repositories: ["repositories"] as const,
  issues: ["issues"] as const,
  issue: (id: string) => ["issues", id] as const,
  runs: ["runs"] as const,
  runsForIssue: (issueId: string) => ["runs", { issueId }] as const,
  run: (id: string) => ["run", id] as const,
  runDiff: (id: string) => ["run", id, "diff"] as const,
  runReview: (id: string) => ["run", id, "review"] as const,
  runPullRequest: (id: string) => ["run", id, "pr"] as const,
};
