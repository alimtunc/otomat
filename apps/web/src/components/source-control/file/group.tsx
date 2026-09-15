import type { DiffFileContract, SourceControlAction } from "@otomat/domain";
import { Icon, IconButton } from "@otomat/ui";
import { ChangeFileRow } from "@web/components/source-control/file/row";

export interface ChangeFileGroupProps {
  staged: boolean;
  files: DiffFileContract[];
  activePath: string | null;
  pending: boolean;
  onSelect: (path: string) => void;
  onAction: (path: string | undefined, action: SourceControlAction) => void;
}

export function ChangeFileGroup({
  staged,
  files,
  activePath,
  pending,
  onSelect,
  onAction,
}: ChangeFileGroupProps) {
  const label = staged ? "Staged Changes" : "Changes";
  return (
    <section aria-label={label}>
      <h2 className="flex items-center justify-between bg-surface-2 px-3 py-2 text-xs font-medium">
        {label}
        <span className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-text-tertiary">{files.length}</span>
          <IconButton
            label={staged ? "Unstage all" : "Stage all"}
            icon={<Icon name={staged ? "arrow-down" : "plus"} aria-hidden />}
            disabled={pending || files.length === 0}
            onClick={() => onAction(undefined, staged ? "unstage" : "stage")}
          />
          {staged ? null : (
            <IconButton
              label="Discard all"
              icon={<Icon name="trash-2" aria-hidden />}
              disabled={pending || files.length === 0}
              onClick={() => onAction(undefined, "discard")}
            />
          )}
        </span>
      </h2>
      {files.length === 0 ? (
        <p className="px-3 py-3 text-xs text-text-tertiary">
          {staged ? "No staged changes." : "No unstaged changes."}
        </p>
      ) : (
        <ul>
          {files.map((file) => (
            <ChangeFileRow
              key={file.path}
              file={file}
              staged={staged}
              active={activePath === file.path}
              pending={pending}
              onSelect={() => onSelect(file.path)}
              onAction={(action) => onAction(file.path, action)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
