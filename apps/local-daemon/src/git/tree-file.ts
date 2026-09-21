import type { WorktreeFileEntry } from "@otomat/domain";

import { runGit, runGitBytes } from "./git-cli.js";

/** A symlink is a blob whose mode says it points elsewhere; reading it would leak whatever the host has at the target. */
const SYMLINK_MODE = "120000";

export interface TreeFileLimits {
  maxBytes: number;
}

/** `oid` is git's own blob id: the revision a later write must present to prove it saw this content. */
export type TreeFileRead =
  | { kind: "text"; text: string; bytes: number; oid: string }
  | { kind: "missing" }
  | { kind: "symlink" }
  | { kind: "directory" }
  | { kind: "binary"; bytes: number; oid: string }
  | { kind: "too_large"; bytes: number };

export interface TreeEntry {
  mode: string;
  type: string;
  oid: string;
  size: number;
  path: string;
}

function parseTreeRecord(record: string): TreeEntry | null {
  const [meta, path] = record.split("\t");
  const [mode, type, oid, size] = (meta ?? "").split(/\s+/);
  if (!mode || !type || !oid || path === undefined) return null;
  return { mode, type, oid, size: Number.parseInt(size ?? "0", 10) || 0, path };
}

export function lsTree(gitCwd: string, tree: string, path: string): TreeEntry | null {
  const result = runGit(
    [
      "--literal-pathspecs",
      "-c",
      "core.quotepath=false",
      "ls-tree",
      "--long",
      "-z",
      tree,
      "--",
      path,
    ],
    { cwd: gitCwd, allowFailure: true },
  );
  if (result.exitCode !== 0) return null;
  const [record] = result.stdout.split("\0");
  return record === undefined || record === "" ? null : parseTreeRecord(record);
}

function entryKind(entry: TreeEntry): WorktreeFileEntry["kind"] {
  if (entry.mode === SYMLINK_MODE) return "symlink";
  return entry.type === "commit" ? "submodule" : "file";
}

export function listTreeFiles(gitCwd: string, tree: string): WorktreeFileEntry[] {
  const out = runGit(["-c", "core.quotepath=false", "ls-tree", "-r", "--long", "-z", tree], {
    cwd: gitCwd,
  }).stdout;
  const entries: WorktreeFileEntry[] = [];
  for (const record of out.split("\0")) {
    const entry = record === "" ? null : parseTreeRecord(record);
    if (entry === null || entry.type === "tree") continue;
    entries.push({ path: entry.path, kind: entryKind(entry), size: entry.size, ignored: false });
  }
  return entries;
}

export function readTreeBlob(gitCwd: string, oid: string): Buffer {
  return runGitBytes(["cat-file", "blob", oid], { cwd: gitCwd }).stdout;
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
  if (content.stdout.includes("\0")) return { kind: "binary", bytes: entry.size, oid: entry.oid };
  return { kind: "text", text: content.stdout, bytes: entry.size, oid: entry.oid };
}
