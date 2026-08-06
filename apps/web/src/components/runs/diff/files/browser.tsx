import type { DiffFileContract, RunDiffContract } from "@otomat/domain";
import { DiffFileList } from "@web/components/runs/diff/files/list";
import { DiffFileTree } from "@web/components/runs/diff/files/tree";
import { DiffStat } from "@web/components/runs/diff/stat";
import type { DiffBrowserMode } from "@web/components/runs/diff/view-prefs";
import { PaneHeader } from "@web/components/runs/pane-header";

export interface DiffFileBrowserProps {
  diff: RunDiffContract;
  mode: DiffBrowserMode;
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelect: (file: DiffFileContract) => void;
}

/** The changed-file sidebar. Files and Tree render the same rows over the same state. */
export function DiffFileBrowser({
  diff,
  mode,
  activePath,
  reviewedPaths,
  onSelect,
}: DiffFileBrowserProps) {
  const rowProps = { files: diff.files, activePath, reviewedPaths, onSelect };
  return (
    <nav aria-label="Changed files" className="min-h-0 flex-1 overflow-auto bg-sidebar">
      <PaneHeader className="bg-sidebar">
        {mode === "tree" ? "Tree" : "Files"}
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] font-normal normal-case">
          <DiffStat additions={diff.additions} deletions={diff.deletions} />
        </span>
      </PaneHeader>
      {mode === "tree" ? <DiffFileTree {...rowProps} /> : <DiffFileList {...rowProps} />}
    </nav>
  );
}
