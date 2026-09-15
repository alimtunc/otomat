import type { DiffFileContract } from "@otomat/domain";
import { FileTree } from "@web/components/runs/diff/files/file-tree";
import { diffFileLabels } from "@web/components/runs/diff/files/path";
import { DiffFileRow } from "@web/components/runs/diff/files/row";

export interface DiffFileTreeProps {
  files: readonly DiffFileContract[];
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelect: (file: DiffFileContract) => void;
}

export function DiffFileTree({ files, activePath, reviewedPaths, onSelect }: DiffFileTreeProps) {
  return (
    <FileTree
      files={files}
      activePath={activePath}
      renderFile={(file, depth) => (
        <DiffFileRow
          file={file}
          active={file.path === activePath}
          reviewed={reviewedPaths.has(file.path)}
          detail={diffFileLabels(file).move ?? ""}
          indent={depth}
          onSelect={onSelect}
        />
      )}
    />
  );
}
