import type { ChangeStatus } from "@otomat/domain";
import { Button, Icon, cn } from "@otomat/ui";
import { INDENT_REM, ROW_PADDING_REM } from "@web/components/files/tree/indent";
import { STATUS_LETTER } from "@web/components/files/tree/status";

export interface FolderRowProps {
  path: string;
  label: string;
  depth: number;
  expanded: boolean;
  selected?: boolean;
  onToggle: (path: string) => void;
  status?: ChangeStatus;
}

export function FolderRow({
  path,
  label,
  depth,
  expanded,
  selected,
  onToggle,
  status,
}: FolderRowProps) {
  const color = status === undefined ? undefined : STATUS_LETTER[status].className;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={path}
      aria-expanded={expanded}
      aria-current={selected ? "true" : undefined}
      onClick={() => onToggle(path)}
      style={{ paddingLeft: `${ROW_PADDING_REM + depth * INDENT_REM}rem` }}
      className={cn(
        "h-7 w-full justify-start gap-1.5 rounded-none pr-3 text-xs font-normal text-text-secondary hover:bg-hover",
        selected && "bg-selected text-foreground",
      )}
    >
      <Icon
        name={expanded ? "chevron-down" : "chevron-right"}
        className="h-3 w-3 shrink-0 text-text-tertiary"
      />
      <Icon
        name={expanded ? "folder-open" : "folder"}
        className="size-3.5 shrink-0 text-text-tertiary"
        aria-hidden
      />
      <span className={cn("min-w-0 flex-1 truncate text-left", color)}>{label}</span>
      {status === undefined ? null : (
        <span
          role="img"
          aria-label="Contains changes"
          title="Contains changes"
          className={cn("size-1.5 shrink-0 rounded-full bg-current", color)}
        />
      )}
    </Button>
  );
}
