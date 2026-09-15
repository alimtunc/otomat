import type { ChangeSelection, DiffFileContract, SourceControlAction } from "@otomat/domain";
import { parsePatchHunks } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { ChangeBlock } from "@web/components/source-control/change-block";

export interface ChangeFileDiffProps {
  file: DiffFileContract;
  staged: boolean;
  pending: boolean;
  onAction: (action: SourceControlAction, selection?: ChangeSelection) => void;
}

export function ChangeFileDiff({ file, staged, pending, onAction }: ChangeFileDiffProps) {
  const header = file.patch.slice(0, file.patch.indexOf("\n@@ ") + 1);
  const hunks = parsePatchHunks(file.patch).map((hunk) => `${header}${hunk.text}`);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 text-xs">
        <span className="min-w-0 flex-1 truncate font-mono" title={file.path}>
          {file.path}
        </span>
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => onAction(staged ? "unstage" : "stage")}
        >
          {staged ? "Unstage file" : "Stage file"}
        </Button>
        {!staged ? (
          <Button size="xs" variant="ghost" disabled={pending} onClick={() => onAction("discard")}>
            Discard file
          </Button>
        ) : null}
      </div>
      <p className="border-b border-border-subtle px-3 py-1.5 text-xs text-text-tertiary">
        {staged ? "Last commit → staging area" : "Staging area → working files"}
      </p>
      <div className="min-h-0 flex-1 overflow-auto">
        {hunks.length === 0 ? (
          <p className="px-3 py-4 text-sm text-text-secondary">
            {file.binary
              ? "Binary file — no textual diff."
              : "File metadata changed — no textual diff."}
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
