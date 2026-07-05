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
// Canonical diff/stats/changed-files primitives are part of the contract (OTO-9/11).
export * from "./diff.js";
export { detectDefaultBranch } from "./repo.js";
export * from "./service.js";
