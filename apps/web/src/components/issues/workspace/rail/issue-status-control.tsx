import { manualIssueTargets, type IssueContract } from "@otomat/domain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FOCUS_RING,
  IssueStatusChip,
  resolveStatus,
} from "@otomat/ui";
import { issueStatusErrorMessage, useSetIssueStatus } from "@web/api/issues/mutations";

/** Falls back to a plain chip whenever nothing is offerable: a mirrored issue, or one the machine has no manual edge out of. */
export function IssueStatusControl({ issue }: { issue: IssueContract }) {
  const setStatus = useSetIssueStatus(issue.id);
  const targets = issue.source === "local" ? manualIssueTargets(issue.status) : [];

  if (targets.length === 0) return <IssueStatusChip status={issue.status} />;
  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Set issue status"
          disabled={setStatus.isPending}
          className={`rounded-full transition-opacity duration-100 hover:opacity-80 disabled:pointer-events-none ${FOCUS_RING}`}
        >
          <IssueStatusChip status={issue.status} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {targets.map((target) => (
            <DropdownMenuItem key={target} onClick={() => setStatus.mutate({ status: target })}>
              {`Mark ${resolveStatus("issue", target).label.toLowerCase()}`}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {setStatus.isError ? (
        <p role="alert" className="text-xs text-danger">
          {issueStatusErrorMessage(setStatus.error)}
        </p>
      ) : null}
    </div>
  );
}
