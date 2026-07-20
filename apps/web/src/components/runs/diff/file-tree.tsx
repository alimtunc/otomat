import type { DiffFileContract, RunDiffContract } from "@otomat/domain";
import { cn, Icon, resolveStatus } from "@otomat/ui";
import { STATUS_LETTER } from "@web/components/runs/diff/file-tree.utils";
import { DiffStat } from "@web/components/runs/diff/stat";
import { PaneHeader } from "@web/components/runs/pane-header";

export function DiffFileTree({
  diff,
  activePath,
  reviewedPaths,
  onSelect,
}: {
  diff: RunDiffContract;
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelect: (file: DiffFileContract) => void;
}) {
  return (
    <nav
      aria-label="Changed files"
      className="min-h-0 overflow-auto border-r border-border-subtle bg-sidebar"
    >
      <PaneHeader className="bg-sidebar">
        Files
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] font-normal normal-case">
          <DiffStat additions={diff.additions} deletions={diff.deletions} />
        </span>
      </PaneHeader>
      <ul className="py-1">
        {diff.files.map((file) => {
          const status = STATUS_LETTER[file.status];
          const active = file.path === activePath;
          return (
            <li key={file.path}>
              <button
                type="button"
                onClick={() => onSelect(file)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-7 w-full items-center gap-1.75 px-3 text-xs text-text-secondary hover:bg-hover",
                  active && "bg-selected text-foreground",
                )}
              >
                <span
                  aria-label={resolveStatus("diffFile", file.status).label}
                  className={cn("w-3 text-center font-mono text-[10px]", status.className)}
                >
                  {status.letter}
                </span>
                <span className="min-w-0 flex-1 truncate text-left">{file.path}</span>
                {reviewedPaths.has(file.path) ? (
                  <Icon
                    name="check"
                    aria-label="Reviewed"
                    className="h-3 w-3 shrink-0 text-success"
                  />
                ) : null}
                <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums">
                  <DiffStat additions={file.additions} deletions={file.deletions} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
