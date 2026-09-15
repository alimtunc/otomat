import type { DiffFileContract, SourceControlAction } from "@otomat/domain";
import { Button, FileIcon, Icon, IconButton, cn } from "@otomat/ui";
import { STATUS_LETTER } from "@web/components/runs/diff/files/status";

export interface ChangeFileRowProps {
  file: DiffFileContract;
  staged: boolean;
  active: boolean;
  pending: boolean;
  onSelect: () => void;
  onAction: (action: SourceControlAction) => void;
}

export function ChangeFileRow({
  file,
  staged,
  active,
  pending,
  onSelect,
  onAction,
}: ChangeFileRowProps) {
  const status = STATUS_LETTER[file.status];
  return (
    <li className={cn("flex items-center gap-1 pr-1", active && "bg-selected")}>
      <Button
        variant="ghost"
        size="sm"
        className="min-w-0 flex-1 justify-start gap-2 rounded-none px-2 font-normal"
        title={file.path}
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
      >
        <FileIcon path={file.path} />
        <span className="min-w-0 flex-1 truncate text-left text-xs">{file.path}</span>
        <span className={cn("font-mono text-micro", status.className)} aria-label={file.status}>
          {status.letter}
        </span>
      </Button>
      <IconButton
        label={`${staged ? "Unstage" : "Stage"} ${file.path}`}
        icon={<Icon name={staged ? "arrow-down" : "plus"} aria-hidden />}
        disabled={pending}
        onClick={() => onAction(staged ? "unstage" : "stage")}
      />
      {!staged ? (
        <IconButton
          label={`Discard ${file.path}`}
          icon={<Icon name="trash-2" aria-hidden />}
          disabled={pending}
          onClick={() => onAction("discard")}
        />
      ) : null}
    </li>
  );
}
