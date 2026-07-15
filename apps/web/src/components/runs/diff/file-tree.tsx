import type { ChangeStatus, DiffFileContract, RunDiffContract } from "@otomat/domain";
import { cn } from "@otomat/ui";
import { DiffStat } from "@web/components/runs/diff/stat";

const STATUS_LETTER: Record<ChangeStatus, { letter: string; className: string }> = {
  added: { letter: "A", className: "text-success" },
  modified: { letter: "M", className: "text-warning" },
  deleted: { letter: "D", className: "text-danger" },
  renamed: { letter: "R", className: "text-iris-text" },
  copied: { letter: "C", className: "text-iris-text" },
  type_changed: { letter: "T", className: "text-text-tertiary" },
};

export function diffFileDomId(file: DiffFileContract): string {
  return `diff-file-${file.sha.slice(0, 12)}`;
}

export function DiffFileTree({
  diff,
  activePath,
  onSelect,
}: {
  diff: RunDiffContract;
  activePath: string | null;
  onSelect: (file: DiffFileContract) => void;
}) {
  return (
    <nav
      aria-label="Changed files"
      className="min-h-0 overflow-auto border-r border-border-subtle bg-sidebar"
    >
      <div className="sticky top-0 z-[2] flex h-8.5 items-center gap-2 border-b border-border-subtle bg-sidebar px-3.5 text-micro font-semibold uppercase tracking-[0.04em] text-text-tertiary">
        Files
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] font-normal normal-case">
          <DiffStat additions={diff.additions} deletions={diff.deletions} />
        </span>
      </div>
      <ul className="py-1">
        {diff.files.map((file) => {
          const status = STATUS_LETTER[file.status];
          const active = file.path === activePath;
          return (
            <li key={file.path}>
              <button
                type="button"
                onClick={() => onSelect(file)}
                className={cn(
                  "flex h-7 w-full items-center gap-1.75 px-3 text-xs text-text-secondary hover:bg-hover",
                  active && "bg-selected text-foreground",
                )}
              >
                <span
                  aria-label={file.status}
                  className={cn("w-3 text-center font-mono text-[10px]", status.className)}
                >
                  {status.letter}
                </span>
                <span className="min-w-0 flex-1 truncate text-left">{file.path}</span>
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
