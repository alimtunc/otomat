import { Button, cn, FileIcon } from "@otomat/ui";
import type { DecoratedFile } from "@web/components/files/decorations";
import { baseName } from "@web/components/runs/diff/files/path";
import { INDENT_REM, ROW_PADDING_REM } from "@web/components/runs/diff/files/row.utils";
import { STATUS_LETTER } from "@web/components/runs/diff/files/status";

export interface FileBrowserRowProps {
  entry: DecoratedFile;
  active: boolean;
  indent: number;
  onSelect: (path: string) => void;
}

export function FileBrowserRow({ entry, active, indent, onSelect }: FileBrowserRowProps) {
  const status = entry.status === undefined ? undefined : STATUS_LETTER[entry.status];
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
      <span className="inline-flex shrink-0" title={entry.kind === "file" ? undefined : entry.kind}>
        <FileIcon path={entry.path} />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left",
          status?.className,
          entry.status === "deleted" && "line-through",
        )}
      >
        {baseName(entry.path)}
      </span>
      {status === undefined ? null : (
        <span
          className={cn("shrink-0 font-mono text-micro", status.className)}
          aria-label={entry.status}
          title={entry.status}
        >
          {status.letter}
        </span>
      )}
    </Button>
  );
}
