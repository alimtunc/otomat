import { HostTag, Spinner } from "@otomat/ui";
import type { CleanupOutcome } from "@web/components/workspaces/use-bulk-cleanup";
import { plural } from "@web/lib/plural";
import { workspaceReason } from "@web/lib/workspace/blocker";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { workspaceGitState } from "@web/lib/workspace/state";

export interface CleanupTargetRowProps {
  target: WorkspaceRow;
  outcome: CleanupOutcome | undefined;
}

export function CleanupTargetRow({ target, outcome }: CleanupTargetRowProps) {
  const git = workspaceGitState(target.present, target.uncommitted_files);
  const facts = [
    target.repository_name,
    target.issue_identifier ?? target.run_id ?? "no issue",
    git.detail,
    target.unpushed_commits === null
      ? "unpublished commits unknown"
      : `${plural(target.unpushed_commits, "commit")} only this branch holds`,
    target.pull_request === null
      ? "no pull request"
      : `#${target.pull_request.number ?? "?"}${target.pull_request.merged ? " merged" : ""}`,
  ];

  return (
    <li className="flex flex-col gap-0.5 border-b border-border-subtle py-1.5 last:border-b-0">
      <span className="flex items-center gap-2 text-xs">
        <HostTag tag={target.host.label} />
        <span className="min-w-0 flex-1 truncate font-mono text-text-secondary">
          {target.branch ?? target.path}
        </span>
        {outcome === "pending" ? <Spinner /> : null}
        {outcome !== undefined && outcome !== "pending" ? (
          <span
            role="status"
            className={
              outcome.outcome === "cleaned"
                ? "shrink-0 text-success"
                : "max-w-1/2 truncate text-danger"
            }
            title={outcome.message}
          >
            {outcome.outcome === "cleaned" ? "cleaned" : outcome.message}
          </span>
        ) : null}
      </span>
      <span className="text-micro text-text-tertiary">{facts.join(" · ")}</span>
      <span className="text-micro text-text-tertiary">{workspaceReason(target)}</span>
    </li>
  );
}
