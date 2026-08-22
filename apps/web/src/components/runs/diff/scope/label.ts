import { shortSha, type RunDiffScope } from "@otomat/domain";

export function diffScopeSummary(scope: RunDiffScope): string {
  if (scope.kind === "commit") return `Commit ${scope.short_sha}`;
  if (scope.kind === "step") return `Step ${scope.step_number} · ${scope.step_name}`;
  if (scope.kind === "session") return `Pass · ${scope.step_name}`;
  if (scope.kind === "pull_request") return pullRequestScopeLabel(scope.number);
  return "Workspace";
}

export function diffScopeDetail(scope: RunDiffScope): string {
  if (scope.kind === "commit") {
    return scope.parent === null
      ? `${scope.subject} — a root commit, shown against the empty tree.`
      : `${scope.subject} — shown against its parent ${shortSha(scope.parent)}.`;
  }
  if (scope.kind === "step") {
    return "What this step changed between the snapshot it entered on and the one it left, uncommitted work included.";
  }
  if (scope.kind === "session") {
    return "What this pass changed between its captured start and end trees, uncommitted work included.";
  }
  if (scope.kind === "pull_request") {
    return "The published head against the branch the pull request targets.";
  }
  return "Everything the branch currently carries against its fork point, uncommitted work included.";
}

export function stepChoiceLabel(stepName: string, stepNumber: number): string {
  return `${stepNumber}. ${stepName}`;
}

export function pullRequestScopeLabel(number: number | null): string {
  return number === null ? "Pull request" : `Pull request #${number}`;
}
