import {
  isAgentFixEligible,
  type ReviewCommentContract,
  type ReviewFixAuthority,
} from "@otomat/domain";
import { Chip } from "@otomat/ui";
import { ReviewFixStepDialog } from "@web/components/runs/review/fix-step-dialog";

export interface DiffFixBarProps {
  runId: string;
  /** Whether this run still owns its issue's workspace; a fix is one more step in that same cycle. */
  workspaceOpen: boolean;
  issueId: string | null;
  authority: ReviewFixAuthority;
  comments: readonly ReviewCommentContract[];
}

function ownedHint(workspaceOpen: boolean, count: number): string {
  if (!workspaceOpen) return "Fix is available while this issue’s workspace is still open.";
  if (count === 0) return "Address a comment to the agent to make it part of the next fix step.";
  return "A fix step freezes every open agent comment, its pinned hunk and the current diff as its context.";
}

export function DiffFixBar({
  runId,
  workspaceOpen,
  issueId,
  authority,
  comments,
}: DiffFixBarProps) {
  const count = comments.filter(isAgentFixEligible).length;
  const owned = authority.kind === "otomat";
  const hint = owned ? ownedHint(workspaceOpen, count) : authority.reason;

  return (
    <footer className="flex h-12 flex-none items-center gap-2.5 border-t border-border-subtle bg-surface-1 px-4.5">
      {owned ? null : <Chip tone="neutral">Review only</Chip>}
      <span className="min-w-0 truncate text-xs text-text-tertiary" title={hint}>
        {hint}
      </span>
      {owned ? (
        <span className="ml-auto">
          <ReviewFixStepDialog
            runId={runId}
            issueId={issueId}
            count={count}
            disabled={!workspaceOpen || count === 0}
          />
        </span>
      ) : null}
    </footer>
  );
}
