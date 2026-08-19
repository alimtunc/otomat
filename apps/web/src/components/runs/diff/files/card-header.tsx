import type { DiffFileContract } from "@otomat/domain";
import { Checkbox, cn, DiffFileStatusChip, Icon, IconButton } from "@otomat/ui";
import { diffFileLabels } from "@web/components/runs/diff/files/path";
import { DiffStat } from "@web/components/runs/diff/stat";
import type { ReactNode } from "react";

export interface DiffFileCardHeaderProps {
  file: DiffFileContract;
  stats: boolean;
  indicator: ReactNode;
  active: boolean;
  reviewed: boolean;
  onReviewedChange: (reviewed: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  fullFile: boolean;
  /** Absent when the file has no text to expand, so no full-file action is offered. */
  onFullFileChange: ((fullFile: boolean) => void) | null;
  onCommentFile: () => void;
}

export function DiffFileCardHeader({
  file,
  stats,
  indicator,
  active,
  reviewed,
  onReviewedChange,
  collapsed,
  onCollapsedChange,
  fullFile,
  onFullFileChange,
  onCommentFile,
}: DiffFileCardHeaderProps) {
  const labels = diffFileLabels(file);
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-8.5 items-center gap-2.5 border-b border-border px-2 font-mono text-xs",
        active ? "bg-surface-3" : "bg-surface-1",
      )}
    >
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
        {indicator}
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
        {onFullFileChange === null ? null : (
          <IconButton
            size="sm"
            label={
              fullFile ? `Show only the changes in ${file.path}` : `Expand full file ${file.path}`
            }
            icon={<Icon name={fullFile ? "fold-vertical" : "unfold-vertical"} />}
            aria-pressed={fullFile}
            onClick={() => onFullFileChange(!fullFile)}
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
