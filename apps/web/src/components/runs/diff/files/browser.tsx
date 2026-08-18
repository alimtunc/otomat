import type { DiffFileContract, ReviewDiffContract } from "@otomat/domain";
import { DiffFileList } from "@web/components/runs/diff/files/list";
import { DiffFileTree } from "@web/components/runs/diff/files/tree";
import type { DiffBrowserMode } from "@web/components/runs/diff/prefs/prefs";

export interface DiffFileBrowserProps {
  diff: ReviewDiffContract;
  mode: DiffBrowserMode;
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelect: (file: DiffFileContract) => void;
}

export function DiffFileBrowser({
  diff,
  mode,
  activePath,
  reviewedPaths,
  onSelect,
}: DiffFileBrowserProps) {
  const rowProps = { files: diff.files, activePath, reviewedPaths, onSelect };
  return (
    <nav aria-label="Changed files" className="min-h-0 flex-1 overflow-auto">
      {mode === "tree" ? <DiffFileTree {...rowProps} /> : <DiffFileList {...rowProps} />}
    </nav>
  );
}
