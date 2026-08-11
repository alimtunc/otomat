import type { DiffFileContract } from "@otomat/domain";
import { Checkbox, DiffFileStatusChip, Icon, IconButton } from "@otomat/ui";
import { diffFileLabels } from "@web/components/runs/diff/files/path";
import { DiffStat } from "@web/components/runs/diff/stat";

export interface DiffFileCardHeaderProps {
  file: DiffFileContract;
  stats: boolean;
  reviewed: boolean;
  onReviewedChange: (reviewed: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Absent when the file has no text to expand, so no context action is offered. */
  onExpandContext: (() => void) | null;
  onShowFullFile: (() => void) | null;
  onCommentFile: () => void;
}

export function DiffFileCardHeader({
  file,
  stats,
  reviewed,
  onReviewedChange,
  collapsed,
  onCollapsedChange,
  onExpandContext,
  onShowFullFile,
  onCommentFile,
}: DiffFileCardHeaderProps) {
  const labels = diffFileLabels(file);
  return (
    <header className="sticky top-0 z-10 flex h-9 items-center gap-2.5 rounded-t-md border-b border-border bg-surface-1 px-2 font-mono text-xs">
      <IconButton
        size="sm"
        label={collapsed ? `Expand ${file.path}` : `Collapse ${file.path}`}
        icon={<Icon name={collapsed ? "chevron-right" : "chevron-down"} />}
        onClick={() => onCollapsedChange(!collapsed)}
      />
      <DiffFileStatusChip status={file.status} showLabel={false} />
      <span className="min-w-0 truncate" title={labels.full}>
        {labels.full}
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        {stats ? (
          <span className="flex items-center gap-1.5 pr-1">
            <DiffStat additions={file.additions} deletions={file.deletions} />
          </span>
        ) : null}
        <IconButton
          size="sm"
          label={`Comment on ${file.path}`}
          icon={<Icon name="message-square" />}
          onClick={onCommentFile}
        />
        {onExpandContext === null ? null : (
          <IconButton
            size="sm"
            label={`Expand context in ${file.path}`}
            icon={<Icon name="unfold-vertical" />}
            onClick={onExpandContext}
          />
        )}
        {onShowFullFile === null ? null : (
          <IconButton
            size="sm"
            label={`Show all of ${file.path}`}
            icon={<Icon name="file-text" />}
            onClick={onShowFullFile}
          />
        )}
        <label className="flex cursor-pointer select-none items-center gap-1.5 pl-1.5 font-sans text-xs text-text-secondary">
          <Checkbox
            checked={reviewed}
            onCheckedChange={(checked) => onReviewedChange(checked === true)}
          />
          Reviewed
        </label>
      </span>
    </header>
  );
}
