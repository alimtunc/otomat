import { lstatSync } from "node:fs";
import { join } from "node:path";

import { GitCommandError } from "./errors.js";
import { blobRevision, isPathAbsent, parentRefusal, readWithoutFollowing } from "./file-write.js";
import { runGit } from "./git-cli.js";
import { isInsideRoot } from "./probe.js";
import { namesGitDirectory } from "./repository-path.js";
import type { TreeFileLimits, TreeFileRead } from "./tree-file.js";

/** `path` must not cross a symlink: git refuses a pathspec beyond one instead of answering. */
export function isIgnored(cwd: string, path: string): boolean {
  const args = ["check-ignore", "-q", "--", path];
  const result = runGit(args, { cwd, allowFailure: true });
  if (result.exitCode === 0) return true;
  if (result.exitCode !== 1) throw new GitCommandError(args, cwd, result.exitCode, result.stderr);
  return false;
}

/** A captured tree never carries an ignored file, so it is the one file read from the live worktree; a path git does not ignore stays missing. */
export function readIgnoredFile(
  worktreePath: string,
  path: string,
  limits: TreeFileLimits,
): TreeFileRead {
  if (namesGitDirectory(path)) return { kind: "missing" };
  const parent = parentRefusal(worktreePath, path);
  if (parent === "file_symlink") return { kind: "symlink" };
  if (parent !== null) return { kind: "missing" };
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
  if (stat.isDirectory()) return { kind: "directory" };
  if (!stat.isFile() || !isIgnored(worktreePath, path)) return { kind: "missing" };
  if (stat.size > limits.maxBytes) return { kind: "too_large", bytes: stat.size };
  const content = readWithoutFollowing(target);
  const oid = blobRevision(worktreePath, path, content);
  if (content.includes(0)) return { kind: "binary", bytes: content.length, oid };
  return { kind: "text", text: content.toString("utf8"), bytes: content.length, oid };
}
