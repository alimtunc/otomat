import {
  chmodSync,
  constants,
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

import type { WorktreeFileError } from "@otomat/domain";

import { runGit } from "./git-cli.js";
import { isInsideRoot } from "./probe.js";
import { namesGitDirectory } from "./repository-path.js";

export type WorktreeWriteResult =
  | { kind: "written"; revision: string }
  | { kind: "stale" }
  | { kind: "missing" }
  | { kind: "symlink" };

/** Git's own blob id for `content` at `path`, clean filters included, so it equals what a captured tree records. */
export function blobRevision(worktreePath: string, path: string, content: Buffer): string {
  return runGit(["hash-object", "--path", path, "--stdin"], {
    cwd: worktreePath,
    input: content,
  }).stdout.trim();
}

/** A parent that is a file (ENOTDIR) names nothing, exactly like a missing entry; every other failure is the host's to report. */
export function isPathAbsent(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

export function parentRefusal(cwd: string, path: string): WorktreeFileError | null {
  let parent = cwd;
  for (const part of path.split("/").slice(0, -1)) {
    parent = join(parent, part);
    let stat;
    try {
      stat = lstatSync(parent);
    } catch (error) {
      if (isPathAbsent(error)) return "parent_not_found";
      throw error;
    }
    if (stat.isSymbolicLink()) return "file_symlink";
    if (!stat.isDirectory()) return "parent_not_found";
    if (existsSync(join(parent, ".git"))) return "path_invalid";
  }
  return null;
}

export function readWithoutFollowing(target: string): Buffer {
  const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** `path` must already be repository-relative; a parent reached through a symlink resolves outside the worktree and is refused like the symlink itself. */
export function writeWorktreeFile(
  worktreePath: string,
  path: string,
  expectedRevision: string,
  text: string,
): WorktreeWriteResult {
  if (namesGitDirectory(path)) return { kind: "missing" };
  const target = join(worktreePath, path);
  if (!isInsideRoot(worktreePath, target)) return { kind: "symlink" };
  let stat;
  try {
    stat = lstatSync(target);
  } catch (error) {
    if (isPathAbsent(error)) return { kind: "missing" };
    throw error;
  }
  if (stat.isSymbolicLink()) return { kind: "symlink" };
  if (!stat.isFile()) return { kind: "missing" };

  const current = blobRevision(worktreePath, path, readWithoutFollowing(target));
  if (current !== expectedRevision) return { kind: "stale" };

  const next = Buffer.from(text, "utf8");
  const temp = join(dirname(target), `.${basename(target)}.otomat-${process.pid}.tmp`);
  writeFileSync(temp, next, { mode: stat.mode & 0o777 });
  chmodSync(temp, stat.mode & 0o777);
  renameSync(temp, target);
  return { kind: "written", revision: blobRevision(worktreePath, path, next) };
}
