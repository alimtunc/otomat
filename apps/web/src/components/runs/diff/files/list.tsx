import type { DiffFileContract } from "@otomat/domain";
import { diffFileLabels } from "@web/components/runs/diff/files/path";
import { DiffFileRow } from "@web/components/runs/diff/files/row";

export interface DiffFileListProps {
  files: readonly DiffFileContract[];
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelect: (file: DiffFileContract) => void;
}

export function DiffFileList({ files, activePath, reviewedPaths, onSelect }: DiffFileListProps) {
  return (
    <ul className="py-1">
      {files.map((file) => {
        const labels = diffFileLabels(file);
        return (
          <li key={file.path}>
            <DiffFileRow
              file={file}
              active={file.path === activePath}
              reviewed={reviewedPaths.has(file.path)}
              detail={labels.move ?? labels.directory}
              indent={0}
              onSelect={onSelect}
            />
          </li>
        );
      })}
    </ul>
  );
}
