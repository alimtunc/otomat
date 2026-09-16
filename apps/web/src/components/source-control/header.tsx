import type { CheckoutTarget, SourceControlResponse } from "@otomat/domain";
import { Icon, IconButton } from "@otomat/ui";
import { branchLabel } from "@web/components/files/branch-label";
import { PublishAction } from "@web/components/source-control/publish-action";

export interface SourceControlHeaderProps {
  target: CheckoutTarget;
  changes: SourceControlResponse | undefined;
  pending: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

export function SourceControlHeader({
  target,
  changes,
  pending,
  refreshing,
  onRefresh,
}: SourceControlHeaderProps) {
  return (
    <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-xs">
      <Icon name="folder-git-2" aria-hidden />
      <span className="truncate font-mono">
        {changes === undefined ? null : branchLabel(changes.branch)}
      </span>
      <span className="ml-auto text-text-tertiary">
        {target.kind === "run" ? "Issue worktree" : "Project checkout"}
      </span>
      {changes === undefined ? null : (
        <PublishAction
          target={target}
          changes={changes}
          disabled={pending || changes.conflicts.length > 0}
        />
      )}
      <IconButton
        label="Refresh changes"
        icon={<Icon name="refresh-cw" aria-hidden />}
        loading={refreshing}
        onClick={onRefresh}
      />
    </div>
  );
}
