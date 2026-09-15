import { Button, Icon } from "@otomat/ui";
import { INDENT_REM, ROW_PADDING_REM } from "@web/components/runs/diff/files/row.utils";

export interface FolderRowProps {
  path: string;
  label: string;
  depth: number;
  expanded: boolean;
  onToggle: (path: string) => void;
}

export function FolderRow({ path, label, depth, expanded, onToggle }: FolderRowProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={path}
      aria-expanded={expanded}
      onClick={() => onToggle(path)}
      style={{ paddingLeft: `${ROW_PADDING_REM + depth * INDENT_REM}rem` }}
      className="h-7 w-full justify-start gap-1.5 rounded-none pr-3 text-xs font-normal text-text-secondary hover:bg-hover"
    >
      <Icon
        name={expanded ? "chevron-down" : "chevron-right"}
        className="h-3 w-3 shrink-0 text-text-tertiary"
      />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </Button>
  );
}
