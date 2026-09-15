import { FolderRow } from "@web/components/runs/diff/files/folder-row";
import {
  buildFileTree,
  directoryPaths,
  expandAncestors,
  visibleTreeRows,
  type FileTreeLeaf,
} from "@web/components/runs/diff/files/tree.utils";
import { useMemo, useState, type ReactNode } from "react";

export interface FileTreeProps<T extends FileTreeLeaf> {
  files: readonly T[];
  activePath: string | null;
  /** Folders start closed; the active file's ancestors open on their own. */
  collapsedByDefault?: boolean;
  renderFile: (file: T, depth: number) => ReactNode;
}

export function FileTree<T extends FileTreeLeaf>({
  files,
  activePath,
  collapsedByDefault = false,
  renderFile,
}: FileTreeProps<T>) {
  const nodes = useMemo(() => buildFileTree(files), [files]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() =>
    collapsedByDefault ? directoryPaths(nodes) : new Set<string>(),
  );
  const [revealed, setRevealed] = useState<string | null>(null);

  if (revealed !== activePath) {
    setRevealed(activePath);
    if (activePath !== null) setCollapsed(expandAncestors(collapsed, activePath));
  }

  const rows = visibleTreeRows(nodes, collapsed);

  const toggle = (path: string): void => {
    const next = new Set(collapsed);
    if (!next.delete(path)) next.add(path);
    setCollapsed(next);
  };

  return (
    <ul className="py-1">
      {rows.map(({ node, depth, expanded }) =>
        node.kind === "file" ? (
          <li key={node.file.path}>{renderFile(node.file, depth)}</li>
        ) : (
          <li key={`folder:${node.path}`}>
            <FolderRow
              path={node.path}
              label={node.label}
              depth={depth}
              expanded={expanded}
              onToggle={toggle}
            />
          </li>
        ),
      )}
    </ul>
  );
}
