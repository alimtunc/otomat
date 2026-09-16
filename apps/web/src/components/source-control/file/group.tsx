import type { DiffFileContract, SourceControlAction } from "@otomat/domain";
import { ChangeActions } from "@web/components/source-control/change-actions";
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
      <div className="flex items-center gap-1 bg-surface-2 px-3 py-2 text-xs font-medium">
        <h2 className="mr-auto">
          {label} <span className="text-text-tertiary">{files.length}</span>
        </h2>
        <ChangeActions
          staged={staged}
          pending={pending || files.length === 0}
          subject="all"
          compact
          onAction={(action) => onAction(undefined, action)}
        />
      </div>
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
