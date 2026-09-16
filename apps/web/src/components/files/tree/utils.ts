import type { WorktreeFileEntry } from "@otomat/domain";
import { baseName, joinPath, pathSegments } from "@web/components/files/tree/path";

export interface FileTreeLeaf {
  path: string;
  kind?: WorktreeFileEntry["kind"];
}

export interface FileTreeHandle {
  toggleAll: () => void;
}

export interface FileTreeDirectory<T extends FileTreeLeaf> {
  kind: "directory";
  /** Full path of the deepest folder in this row; also its collapse key. */
  path: string;
  /** Display label, holding the whole `a/b/c` run when single-child folders compacted. */
  label: string;
  children: FileTreeNode<T>[];
}

export interface FileTreeFile<T extends FileTreeLeaf> {
  kind: "file";
  file: T;
}

export type FileTreeNode<T extends FileTreeLeaf> = FileTreeDirectory<T> | FileTreeFile<T>;

export interface FileTreeRow<T extends FileTreeLeaf> {
  node: FileTreeNode<T>;
  depth: number;
  /** Directories only: false when the folder is collapsed and its subtree is hidden. */
  expanded: boolean;
}

interface Draft<T extends FileTreeLeaf> {
  path: string;
  directories: Map<string, Draft<T>>;
  files: T[];
}

function draft<T extends FileTreeLeaf>(path: string): Draft<T> {
  return { path, directories: new Map(), files: [] };
}

const FILE_COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function byTreeOrder<T extends FileTreeLeaf>(a: FileTreeNode<T>, b: FileTreeNode<T>): number {
  if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
  const left = a.kind === "directory" ? a.label : baseName(a.file.path);
  const right = b.kind === "directory" ? b.label : baseName(b.file.path);
  return FILE_COLLATOR.compare(left, right) || left.localeCompare(right, "en");
}

function compact<T extends FileTreeLeaf>(directory: FileTreeDirectory<T>): FileTreeDirectory<T> {
  const only = directory.children[0];
  if (directory.children.length !== 1 || only === undefined || only.kind !== "directory") {
    return directory;
  }
  return { ...only, label: `${directory.label}/${only.label}` };
}

function toNodes<T extends FileTreeLeaf>(current: Draft<T>): FileTreeNode<T>[] {
  const nodes: FileTreeNode<T>[] = [];
  for (const child of current.directories.values()) {
    const label = baseName(child.path);
    nodes.push(compact({ kind: "directory", path: child.path, label, children: toNodes(child) }));
  }
  for (const file of current.files) {
    nodes.push({ kind: "file", file });
  }
  return nodes.toSorted(byTreeOrder);
}

export function buildFileTree<T extends FileTreeLeaf>(files: readonly T[]): FileTreeNode<T>[] {
  const root = draft<T>("");
  for (const file of files) {
    const segments = pathSegments(file.path);
    let current = root;
    for (const segment of file.kind === "directory" ? segments : segments.slice(0, -1)) {
      const path = joinPath(current.path, segment);
      const existing = current.directories.get(path) ?? draft<T>(path);
      current.directories.set(path, existing);
      current = existing;
    }
    if (file.kind !== "directory") current.files.push(file);
  }
  return toNodes(root);
}

export function directoryPaths<T extends FileTreeLeaf>(
  nodes: readonly FileTreeNode<T>[],
): Set<string> {
  const paths = new Set<string>();
  const walk = (level: readonly FileTreeNode<T>[]): void => {
    for (const node of level) {
      if (node.kind !== "directory") continue;
      paths.add(node.path);
      walk(node.children);
    }
  };
  walk(nodes);
  return paths;
}

export function visibleTreeRows<T extends FileTreeLeaf>(
  nodes: readonly FileTreeNode<T>[],
  collapsed: ReadonlySet<string>,
): FileTreeRow<T>[] {
  const rows: FileTreeRow<T>[] = [];
  const walk = (level: readonly FileTreeNode<T>[], depth: number) => {
    for (const node of level) {
      if (node.kind === "file") {
        rows.push({ node, depth, expanded: true });
        continue;
      }
      const expanded = !collapsed.has(node.path);
      rows.push({ node, depth, expanded });
      if (expanded) walk(node.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return rows;
}

export function expandAncestors(collapsed: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const hiding = [...collapsed].filter((directory) => path.startsWith(`${directory}/`));
  if (hiding.length === 0) return collapsed;
  const next = new Set(collapsed);
  for (const directory of hiding) next.delete(directory);
  return next;
}

export function insertionPosition<T extends FileTreeLeaf>(
  rows: readonly FileTreeRow<T>[],
  directory: string,
): { index: number; depth: number } | null {
  const parent = rows.findIndex(
    (row) => row.node.kind === "directory" && row.node.path === directory,
  );
  const parentRow = rows[parent];
  if (directory !== "" && (parentRow === undefined || !parentRow.expanded)) return null;
  const depth = parentRow === undefined ? 0 : parentRow.depth + 1;
  const index = rows.findIndex(
    (row, i) =>
      i > parent && (row.depth < depth || (row.depth === depth && row.node.kind === "file")),
  );
  return { index: index < 0 ? rows.length : index, depth };
}

type TreeKeyStep = { focus: number } | { toggle: string } | null;

export function treeKeyStep<T extends FileTreeLeaf>(
  rows: readonly FileTreeRow<T>[],
  index: number,
  key: string,
): TreeKeyStep {
  const row = rows[index];
  if (row === undefined) return null;
  const last = rows.length - 1;
  if (key === "ArrowDown") return { focus: Math.min(index + 1, last) };
  if (key === "ArrowUp") return { focus: Math.max(index - 1, 0) };
  if (key === "Home") return { focus: 0 };
  if (key === "End") return { focus: last };
  if (key === "ArrowRight") {
    if (row.node.kind !== "directory") return null;
    return row.expanded ? { focus: Math.min(index + 1, last) } : { toggle: row.node.path };
  }
  if (key === "ArrowLeft") {
    if (row.node.kind === "directory" && row.expanded) return { toggle: row.node.path };
    const parent = rows.findLastIndex((candidate, i) => i < index && candidate.depth < row.depth);
    return parent < 0 ? null : { focus: parent };
  }
  return null;
}
