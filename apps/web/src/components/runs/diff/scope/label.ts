import { shortSha, type RunDiffScope } from "@otomat/domain";

export function diffScopeSummary(scope: RunDiffScope): string {
  if (scope.kind === "commit") return `Commit ${scope.short_sha}`;
  if (scope.kind === "session") return `Pass · ${scope.step_name}`;
  return "Workspace";
}

export function diffScopeDetail(scope: RunDiffScope): string {
  if (scope.kind === "commit") {
    return scope.parent === null
      ? `${scope.subject} — a root commit, shown against the empty tree.`
      : `${scope.subject} — shown against its parent ${shortSha(scope.parent)}.`;
  }
  if (scope.kind === "session") {
    return `What this pass changed between its captured start and end trees, uncommitted work included.`;
  }
  return "Everything the branch currently carries against its fork point, uncommitted work included.";
}

/** A pass is named by the step it ran and its rank, since one step can be run more than once. */
export function passChoiceLabel(stepName: string, ordinal: number): string {
  return `${ordinal}. ${stepName}`;
}
