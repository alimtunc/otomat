import type { DiffFileContract } from "@otomat/domain";
import { Button, cn, Icon, resolveStatus } from "@otomat/ui";
import { diffFileLabels } from "@web/components/runs/diff/files/path";
import { INDENT_REM, ROW_PADDING_REM } from "@web/components/runs/diff/files/row.utils";
import { STATUS_LETTER } from "@web/components/runs/diff/files/status";
import { DiffStat } from "@web/components/runs/diff/stat";

export interface DiffFileRowProps {
  file: DiffFileContract;
  active: boolean;
  reviewed: boolean;
  /** Secondary text the row may ellipsize away: the folder in Files, a move in Tree. */
  detail: string;
  indent: number;
  onSelect: (file: DiffFileContract) => void;
}

export function DiffFileRow({
  file,
  active,
  reviewed,
  detail,
  indent,
  onSelect,
}: DiffFileRowProps) {
  const status = STATUS_LETTER[file.status];
  const labels = diffFileLabels(file);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={labels.full}
      onClick={() => onSelect(file)}
      aria-current={active ? "true" : undefined}
      style={{ paddingLeft: `${ROW_PADDING_REM + indent * INDENT_REM}rem` }}
      className={cn(
        "h-7 w-full justify-start gap-1.5 rounded-none pr-3 text-xs font-normal text-text-secondary hover:bg-hover",
        active && "bg-selected text-foreground",
      )}
    >
      <span
        aria-label={resolveStatus("diffFile", file.status).label}
        className={cn("w-3 shrink-0 text-center font-mono text-micro", status.className)}
      >
        {status.letter}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left">
        <span className="min-w-0 shrink truncate">{labels.name}</span>
        {detail === "" ? null : (
          <span className="min-w-0 shrink-[999] truncate text-micro text-text-tertiary">
            {detail}
          </span>
        )}
      </span>
      {reviewed ? (
        <Icon name="check" aria-label="Reviewed" className="h-3 w-3 shrink-0 text-success" />
      ) : null}
      <span className="flex shrink-0 items-center gap-1 font-mono text-micro tabular-nums">
        <DiffStat additions={file.additions} deletions={file.deletions} />
      </span>
    </Button>
  );
}
