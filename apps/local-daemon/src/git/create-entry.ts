import { closeSync, constants, existsSync, lstatSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";

import type { CreateWorktreeEntryRequest, WorktreeFileError } from "@otomat/domain";

import { GitCommandError } from "./errors.js";
import { isPathAbsent } from "./file-write.js";
import { runGit } from "./git-cli.js";

function parentRefusal(cwd: string, path: string): WorktreeFileError | null {
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

/** `path` must already pass `isCreatableRepositoryPath`; a symlinked parent is refused because the entry would land where the tree does not show it. */
export function createWorktreeEntry(
  cwd: string,
  { path, kind }: CreateWorktreeEntryRequest,
): WorktreeFileError | null {
  const parentError = parentRefusal(cwd, path);
  if (parentError !== null) return parentError;
  const args = ["check-ignore", "-q", "--", kind === "directory" ? `${path}/` : path];
  const ignored = runGit(args, { cwd, allowFailure: true });
  if (ignored.exitCode === 0) return "path_ignored";
  if (ignored.exitCode !== 1) {
    throw new GitCommandError(args, cwd, ignored.exitCode, ignored.stderr);
  }
  const target = join(cwd, path);
  try {
    if (kind === "directory") mkdirSync(target);
    else
      closeSync(
        openSync(
          target,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o666,
        ),
      );
  } catch (error) {
    if (isPathAbsent(error)) return "parent_not_found";
    if (error instanceof Error && "code" in error) {
      if (error.code === "EEXIST") return "path_exists";
      if (error.code === "ELOOP") return "file_symlink";
    }
    throw error;
  }
  return null;
}
