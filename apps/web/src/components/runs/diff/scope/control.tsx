import type { RunDiffScope, RunDiffScopeSelector } from "@otomat/domain";
import {
  ConfigMenu,
  ConfigMenuChoice,
  ConfigMenuContent,
  ConfigMenuNote,
  ConfigMenuProblem,
  ConfigMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
} from "@otomat/ui";
import { useRunPullRequest } from "@web/api/prs/queries";
import { DiffCommitSubmenu } from "@web/components/runs/diff/scope/commit-submenu";
import {
  diffScopeDetail,
  diffScopeSummary,
  pullRequestScopeLabel,
} from "@web/components/runs/diff/scope/label";
import { DiffStepSubmenu } from "@web/components/runs/diff/scope/step-submenu";
import type { RunDiffStep } from "@web/lib/run/diff-steps";
import { useState } from "react";

export interface DiffScopeControlProps {
  runId: string;
  scope: RunDiffScope;
  steps: readonly RunDiffStep[];
  onSelect: (selector: RunDiffScopeSelector) => void;
}

export function DiffScopeControl({ runId, scope, steps, onSelect }: DiffScopeControlProps) {
  const [open, setOpen] = useState(false);
  const pullRequest = useRunPullRequest(runId);
  // The answered scope keeps its choice on screen even before the read lands, so it never shows unchecked.
  const number =
    pullRequest.data?.pull_request?.number ?? (scope.kind === "pull_request" ? scope.number : null);

  return (
    <ConfigMenu open={open} onOpenChange={setOpen}>
      <ConfigMenuTrigger
        label="Diff scope"
        summary={diffScopeSummary(scope)}
        detail={diffScopeDetail(scope)}
        size="xs"
      />
      <ConfigMenuContent align="start" aria-label="Diff scope">
        {pullRequest.isError ? (
          <ConfigMenuProblem
            message="The run's pull request could not be read."
            onRetry={() => void pullRequest.refetch()}
          />
        ) : null}
        {pullRequest.isPending ? (
          <ConfigMenuNote>Reading the run's pull request…</ConfigMenuNote>
        ) : null}
        <DropdownMenuRadioGroup
          value={scope.kind === "branch" || scope.kind === "pull_request" ? scope.kind : ""}
          onValueChange={(next) =>
            onSelect(next === "pull_request" ? { kind: "pull_request" } : { kind: "branch" })
          }
        >
          <ConfigMenuChoice
            value="branch"
            label="Branch"
            description="The current branch against the base it will land on."
          />
          {number === null ? null : (
            <ConfigMenuChoice
              value="pull_request"
              label={pullRequestScopeLabel(number)}
              description="The published head against the branch it targets."
            />
          )}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DiffCommitSubmenu runId={runId} scope={scope} open={open} onSelect={onSelect} />
        <DiffStepSubmenu scope={scope} steps={steps} onSelect={onSelect} />
      </ConfigMenuContent>
    </ConfigMenu>
  );
}
