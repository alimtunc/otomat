import { runGit } from "./git-cli.js";

/** A symlink is a blob whose mode says it points elsewhere; reading it would leak whatever the host has at the target. */
const SYMLINK_MODE = "120000";

export interface TreeFileLimits {
  maxBytes: number;
}

export type TreeFileRead =
  | { kind: "text"; text: string; bytes: number }
  | { kind: "missing" }
  | { kind: "symlink" }
  | { kind: "directory" }
  | { kind: "binary"; bytes: number }
  | { kind: "too_large"; bytes: number };

interface TreeEntry {
  mode: string;
  type: string;
  oid: string;
  size: number;
}

function lsTree(gitCwd: string, tree: string, path: string): TreeEntry | null {
  const result = runGit(
    ["-c", "core.quotepath=false", "ls-tree", "--long", "-z", tree, "--", path],
    { cwd: gitCwd, allowFailure: true },
  );
  if (result.exitCode !== 0) return null;
  const [record] = result.stdout.split("\0");
  if (record === undefined || record === "") return null;
  const [meta] = record.split("\t");
  const [mode, type, oid, size] = (meta ?? "").split(/\s+/);
  if (!mode || !type || !oid) return null;
  return { mode, type, oid, size: Number.parseInt(size ?? "0", 10) || 0 };
}

/** `path` must already have been validated as repository-relative; anything unusable as text is named by kind rather than approximated. */
export function readTreeFile(
  gitCwd: string,
  tree: string,
  path: string,
  limits: TreeFileLimits,
): TreeFileRead {
  const entry = lsTree(gitCwd, tree, path);
  if (entry === null) return { kind: "missing" };
  if (entry.mode === SYMLINK_MODE) return { kind: "symlink" };
  if (entry.type !== "blob") return { kind: "directory" };
  if (entry.size > limits.maxBytes) return { kind: "too_large", bytes: entry.size };
  const content = runGit(["cat-file", "blob", entry.oid], { cwd: gitCwd, allowFailure: true });
  if (content.exitCode !== 0) return { kind: "missing" };
  if (content.stdout.includes("\0")) return { kind: "binary", bytes: entry.size };
  return { kind: "text", text: content.stdout, bytes: entry.size };
}
