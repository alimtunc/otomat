import { baseName, pathSegments } from "@web/components/runs/diff/files/path";

export interface FileTreeLeaf {
  path: string;
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

/** Git orders a tree by entry name with directories sorted as if they ended in `/`. */
function sortKey<T extends FileTreeLeaf>(node: FileTreeNode<T>): string {
  return node.kind === "directory" ? `${node.label}/` : baseName(node.file.path);
}

function byTreeOrder<T extends FileTreeLeaf>(a: FileTreeNode<T>, b: FileTreeNode<T>): number {
  const left = sortKey(a);
  const right = sortKey(b);
  if (left < right) return -1;
  return left > right ? 1 : 0;
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
    for (const segment of segments.slice(0, -1)) {
      const path = current.path === "" ? segment : `${current.path}/${segment}`;
      const existing = current.directories.get(path) ?? draft<T>(path);
      current.directories.set(path, existing);
      current = existing;
    }
    current.files.push(file);
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
