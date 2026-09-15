import type { ChangeStatus } from "@otomat/domain";
import { FolderRow } from "@web/components/runs/diff/files/folder-row";
import {
  buildFileTree,
  directoryPaths,
  expandAncestors,
  visibleTreeRows,
  type FileTreeLeaf,
} from "@web/components/runs/diff/files/tree.utils";
import { readStoredJson, writeStored } from "@web/lib/storage";
import { useMemo, useState, type ReactNode } from "react";

export interface FileTreeProps<T extends FileTreeLeaf> {
  files: readonly T[];
  activePath: string | null;
  /** Folders start closed; the active file's ancestors open on their own. */
  collapsedByDefault?: boolean;
  storageKey?: string;
  directoryStatuses?: ReadonlyMap<string, ChangeStatus>;
  renderFile: (file: T, depth: number) => ReactNode;
}

export function FileTree<T extends FileTreeLeaf>({
  files,
  activePath,
  collapsedByDefault = false,
  storageKey,
  directoryStatuses,
  renderFile,
}: FileTreeProps<T>) {
  const nodes = useMemo(() => buildFileTree(files), [files]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => {
    const saved =
      storageKey === undefined
        ? null
        : readStoredJson(storageKey, (raw) =>
            Array.isArray(raw) && raw.every((path) => typeof path === "string")
              ? new Set<string>(raw)
              : null,
          );
    return saved ?? (collapsedByDefault ? directoryPaths(nodes) : new Set<string>());
  });
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
    if (storageKey !== undefined) writeStored(storageKey, JSON.stringify([...next]));
  };

  return (
    <ul
      className="py-1"
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("li > button")];
        const index = buttons.findIndex((button) => button === document.activeElement);
        const row = rows[index];
        if (row === undefined) return;
        let next = index;
        if (event.key === "ArrowDown") next = Math.min(index + 1, rows.length - 1);
        else if (event.key === "ArrowUp") next = Math.max(index - 1, 0);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = rows.length - 1;
        else if (event.key === "ArrowRight") {
          if (row.node.kind !== "directory") return;
          if (!row.expanded) toggle(row.node.path);
          else next = Math.min(index + 1, rows.length - 1);
        } else if (event.key === "ArrowLeft") {
          if (row.node.kind === "directory" && row.expanded) toggle(row.node.path);
          else
            next = rows.findLastIndex((candidate, i) => i < index && candidate.depth < row.depth);
        } else return;
        event.preventDefault();
        buttons[next]?.focus();
      }}
    >
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
              status={directoryStatuses?.get(node.path)}
            />
          </li>
        ),
      )}
    </ul>
  );
}
