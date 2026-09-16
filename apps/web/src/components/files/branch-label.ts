/** Git answers `HEAD` for a detached checkout, which is not a branch a reader should see named. */
export function branchLabel(branch: string): string {
  return branch === "HEAD" ? "Detached HEAD" : branch;
}
