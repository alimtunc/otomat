import type { DiffFileContract } from "@otomat/domain";
import { baseName, pathSegments } from "@web/components/runs/diff/files/path";

export interface DiffTreeDirectory {
  kind: "directory";
  /** Full path of the deepest folder in this row; also its collapse key. */
  path: string;
  /** Display label, holding the whole `a/b/c` run when single-child folders compacted. */
  label: string;
  children: DiffTreeNode[];
}

export interface DiffTreeFile {
  kind: "file";
  file: DiffFileContract;
}

export type DiffTreeNode = DiffTreeDirectory | DiffTreeFile;

export interface DiffTreeRow {
  node: DiffTreeNode;
  depth: number;
  /** Directories only: false when the folder is collapsed and its subtree is hidden. */
  expanded: boolean;
}

interface Draft {
  path: string;
  directories: Map<string, Draft>;
  files: DiffFileContract[];
}

function draft(path: string): Draft {
  return { path, directories: new Map(), files: [] };
}

/** Git orders a tree by entry name with directories sorted as if they ended in `/`. */
function sortKey(node: DiffTreeNode): string {
  return node.kind === "directory" ? `${node.label}/` : baseName(node.file.path);
}

function byTreeOrder(a: DiffTreeNode, b: DiffTreeNode): number {
  const left = sortKey(a);
  const right = sortKey(b);
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

function compact(directory: DiffTreeDirectory): DiffTreeDirectory {
  const only = directory.children[0];
  if (directory.children.length !== 1 || only === undefined || only.kind !== "directory") {
    return directory;
  }
  return { ...only, label: `${directory.label}/${only.label}` };
}

function toNodes(current: Draft): DiffTreeNode[] {
  const nodes: DiffTreeNode[] = [];
  for (const child of current.directories.values()) {
    const label = baseName(child.path);
    nodes.push(compact({ kind: "directory", path: child.path, label, children: toNodes(child) }));
  }
  for (const file of current.files) {
    nodes.push({ kind: "file", file });
  }
  return nodes.toSorted(byTreeOrder);
}

export function buildDiffFileTree(files: readonly DiffFileContract[]): DiffTreeNode[] {
  const root = draft("");
  for (const file of files) {
    const segments = pathSegments(file.path);
    let current = root;
    for (const segment of segments.slice(0, -1)) {
      const path = current.path === "" ? segment : `${current.path}/${segment}`;
      const existing = current.directories.get(path) ?? draft(path);
      current.directories.set(path, existing);
      current = existing;
    }
    current.files.push(file);
  }
  return toNodes(root);
}

export function visibleTreeRows(
  nodes: readonly DiffTreeNode[],
  collapsed: ReadonlySet<string>,
): DiffTreeRow[] {
  const rows: DiffTreeRow[] = [];
  const walk = (level: readonly DiffTreeNode[], depth: number) => {
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
