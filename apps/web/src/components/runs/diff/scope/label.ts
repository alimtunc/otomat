import { shortSha, type RunDiffScope } from "@otomat/domain";

export function diffScopeSummary(scope: RunDiffScope): string {
  if (scope.kind === "commit") return `Commit ${scope.short_sha}`;
  if (scope.kind === "step") return `Step ${scope.step_number} · ${scope.step_name}`;
  if (scope.kind === "session") return `Pass · ${scope.step_name}`;
  if (scope.kind === "pull_request") return pullRequestScopeLabel(scope.number);
  return scope.branch === null ? "Branch" : `Branch · ${scope.branch}`;
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
  if (scope.branch === null || scope.base_ref === null) {
    return "No branch could be resolved for this run.";
  }
  return `${scope.branch} against ${scope.base_ref}, uncommitted work included.`;
}

export function diffScopeEmptyDescription(scope: RunDiffScope): string {
  const name = diffScopeSummary(scope);
  if (scope.kind === "commit") return `${name} changed no file.`;
  if (scope.kind === "step") {
    return `${name} entered and left on the same tree, so it introduced no change.`;
  }
  if (scope.kind === "session") return `This pass of ${scope.step_name} introduced no change.`;
  if (scope.kind === "pull_request") {
    return `${name} carries no change against the branch it targets.`;
  }
  return `This branch carries no change against ${scope.base_ref ?? "its base"} yet.`;
}

export function stepChoiceLabel(stepName: string, stepNumber: number): string {
  return `${stepNumber}. ${stepName}`;
}

export function pullRequestScopeLabel(number: number | null): string {
  return number === null ? "Pull request" : `Pull request #${number}`;
}
