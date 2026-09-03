/**
 * Worktree/branch lifecycle plus canonical git diff for the daemon. Shells out
 * to `git`, creates/removes worktrees, and mirrors each into the `worktrees`
 * store. One active worktree per owner token is enforced by the store; diffs are
 * computed against each worktree's fork point, while archives commit outstanding
 * work and pin the branch tip. Entry point: `createGitWorktreeService`.
 *
 * @packageDocumentation
 */
export * from "./types.js";
export * from "./errors.js";
export * from "./diff.js";
export { worktreeGitView, type WorktreeGitView } from "./diff-inputs.js";
export { scrubGitEnv } from "./git-cli.js";
export {
  branchExists,
  commitsSince,
  detectDefaultBranch,
  hasCommit,
  headSha,
  isRepositoryRoot,
  listBranches,
  repositoryRemotes,
  searchTrackedFiles,
  uncommittedPaths,
  unpushedCommitCount,
  type CommitSummary,
  type TrackedFileMatches,
} from "./repo.js";
export * from "./pull-request.js";
export { resolveBaseSha } from "./remote-base.js";
export * from "./tree-file.js";
export * from "./probe.js";
export * from "./resolver.js";
export * from "./service-contract.js";
export * from "./service.js";
