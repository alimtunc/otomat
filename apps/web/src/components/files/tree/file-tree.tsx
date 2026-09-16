import type { ChangeStatus } from "@otomat/domain";
import { FolderRow } from "@web/components/files/tree/folder-row";
import { rowIndent } from "@web/components/files/tree/indent";
import {
  buildFileTree,
  directoryPaths,
  expandAncestors,
  insertionPosition,
  treeKeyStep,
  visibleTreeRows,
  type FileTreeHandle,
  type FileTreeLeaf,
} from "@web/components/files/tree/utils";
import { asStrings } from "@web/lib/coerce";
import { readScoped, writeScoped } from "@web/lib/storage";
import { useImperativeHandle, useMemo, useState, type ReactNode, type Ref } from "react";

const FOLDERS_KEY = "otomat.files.folders";

export interface FileTreeProps<T extends FileTreeLeaf> {
  files: readonly T[];
  activePath: string | null;
  /** Folders start closed; the active file's ancestors open on their own. */
  collapsedByDefault?: boolean;
  storageScope?: string;
  directoryStatuses?: ReadonlyMap<string, ChangeStatus>;
  renderFile: (file: T, depth: number) => ReactNode;
  selectedDirectory?: string | null;
  onSelectDirectory?: (path: string) => void;
  insertion?: { directory: string; row: ReactNode };
  ref?: Ref<FileTreeHandle>;
}

export function FileTree<T extends FileTreeLeaf>({
  files,
  activePath,
  collapsedByDefault = false,
  storageScope,
  directoryStatuses,
  renderFile,
  selectedDirectory,
  onSelectDirectory,
  insertion,
  ref,
}: FileTreeProps<T>) {
  const nodes = useMemo(() => buildFileTree(files), [files]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => {
    const saved =
      storageScope === undefined
        ? null
        : readScoped(FOLDERS_KEY, storageScope, (raw) =>
            Array.isArray(raw) ? new Set(asStrings(raw)) : null,
          );
    return saved ?? (collapsedByDefault ? directoryPaths(nodes) : new Set<string>());
  });
  const [revealed, setRevealed] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      toggleAll: () => {
        const allCollapsed = nodes.every(
          (node) => node.kind === "file" || collapsed.has(node.path),
        );
        const next = allCollapsed ? new Set<string>() : directoryPaths(nodes);
        setCollapsed(next);
        if (storageScope !== undefined) writeScoped(FOLDERS_KEY, storageScope, [...next]);
      },
    }),
    [nodes, collapsed, storageScope],
  );

  const revealPath =
    insertion === undefined ? (selectedDirectory ?? activePath) : `${insertion.directory}/`;
  if (revealed !== revealPath) {
    setRevealed(revealPath);
    if (revealPath !== null) setCollapsed(expandAncestors(collapsed, revealPath));
  }

  const rows = visibleTreeRows(nodes, collapsed);
  const position = insertion === undefined ? null : insertionPosition(rows, insertion.directory);

  const toggle = (path: string): void => {
    const next = new Set(collapsed);
    if (!next.delete(path)) next.add(path);
    setCollapsed(next);
    if (storageScope !== undefined) writeScoped(FOLDERS_KEY, storageScope, [...next]);
    onSelectDirectory?.(path);
  };

  const children = rows.map(({ node, depth, expanded }) =>
    node.kind === "file" ? (
      <li key={`file:${node.file.path}`}>{renderFile(node.file, depth)}</li>
    ) : (
      <li key={`folder:${node.path}`}>
        <FolderRow
          path={node.path}
          label={node.label}
          depth={depth}
          expanded={expanded}
          selected={selectedDirectory === node.path}
          onToggle={toggle}
          status={directoryStatuses?.get(node.path)}
        />
      </li>
    ),
  );
  if (position !== null && insertion !== undefined) {
    children.splice(
      position.index,
      0,
      <li key="creation" style={rowIndent(position.depth)}>
        {insertion.row}
      </li>,
    );
  }

  return (
    <ul
      className="py-1"
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("li > button")];
        const index = buttons.findIndex((button) => button === document.activeElement);
        const step = treeKeyStep(rows, index, event.key);
        if (step === null) return;
        event.preventDefault();
        if ("toggle" in step) toggle(step.toggle);
        else buttons[step.focus]?.focus();
      }}
    >
      {children}
    </ul>
  );
}
