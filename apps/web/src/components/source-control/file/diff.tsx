import type { ChangeSelection, DiffFileContract, SourceControlAction } from "@otomat/domain";
import { hunkPatches } from "@otomat/domain";
import { Badge, Button, FileIcon } from "@otomat/ui";
import { unrenderableNote } from "@web/components/runs/diff/files/card.utils";
import { ChangeActions } from "@web/components/source-control/change-actions";
import { ChangeBlock } from "@web/components/source-control/change-block";

export interface ChangeFileDiffProps {
  file: DiffFileContract;
  staged: boolean;
  pending: boolean;
  onAction: (action: SourceControlAction, selection?: ChangeSelection) => void;
  onOpen: () => void;
}

export function ChangeFileDiff({ file, staged, pending, onAction, onOpen }: ChangeFileDiffProps) {
  const hunks = hunkPatches(file.patch);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle px-3 py-1.5 text-xs">
        <div className="flex min-w-0 flex-[1_1_12rem] items-center gap-2">
          <FileIcon path={file.path} />
          <span className="min-w-0 flex-1 truncate font-mono" title={file.path}>
            {file.path}
          </span>
          <Badge
            className="shrink-0"
            title={staged ? "Last commit → staging area" : "Staging area → working files"}
          >
            {staged ? "Staged" : "Unstaged"}
          </Badge>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {file.status === "deleted" ? null : (
            <Button size="xs" variant="ghost" onClick={onOpen}>
              Open file
            </Button>
          )}
          <ChangeActions
            staged={staged}
            pending={pending}
            subject="file"
            onAction={(action) => onAction(action)}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {hunks.length === 0 ? (
          <p className="px-3 py-4 text-sm text-text-secondary">
            {unrenderableNote(file) ?? "File metadata changed — no textual diff."}
          </p>
        ) : (
          hunks.map((patch, index) => (
            <ChangeBlock
              key={`${file.sha}:${index}`}
              file={file}
              patch={patch}
              index={index}
              staged={staged}
              pending={pending}
              onAction={onAction}
            />
          ))
        )}
      </div>
    </div>
  );
}
