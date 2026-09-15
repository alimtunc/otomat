import type { WorktreeFileEntry } from "@otomat/domain";
import { Button, cn, Icon } from "@otomat/ui";
import { baseName } from "@web/components/runs/diff/files/path";
import { INDENT_REM, ROW_PADDING_REM } from "@web/components/runs/diff/files/row.utils";

export interface WorktreeFileRowProps {
  entry: WorktreeFileEntry;
  active: boolean;
  indent: number;
  onSelect: (path: string) => void;
}

export function WorktreeFileRow({ entry, active, indent, onSelect }: WorktreeFileRowProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={entry.path}
      onClick={() => onSelect(entry.path)}
      aria-current={active ? "true" : undefined}
      style={{ paddingLeft: `${ROW_PADDING_REM + indent * INDENT_REM}rem` }}
      className={cn(
        "h-7 w-full justify-start gap-1.5 rounded-none pr-3 text-xs font-normal text-text-secondary hover:bg-hover",
        active && "bg-selected text-foreground",
      )}
    >
      <Icon name="file-text" className="h-3 w-3 shrink-0 text-text-tertiary" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{baseName(entry.path)}</span>
      {entry.kind === "file" ? null : (
        <span className="shrink-0 text-micro text-text-tertiary">{entry.kind}</span>
      )}
    </Button>
  );
}
