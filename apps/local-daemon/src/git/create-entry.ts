import { closeSync, constants, existsSync, lstatSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";

import type { CreateWorktreeEntryRequest, WorktreeFileError } from "@otomat/domain";

import { runGit } from "./git-cli.js";
import { isRepositoryRelative } from "./repository-path.js";

export function createWorktreeEntry(
  cwd: string,
  { path, kind }: CreateWorktreeEntryRequest,
): WorktreeFileError | null {
  if (
    !isRepositoryRelative(path) ||
    path.includes("\0") ||
    path.includes("\\") ||
    path.split("/").some((part) => part === "" || part === "." || part.toLowerCase() === ".git")
  )
    return "path_invalid";
  try {
    let parent = cwd;
    for (const part of path.split("/").slice(0, -1)) {
      parent = join(parent, part);
      const stat = lstatSync(parent);
      if (stat.isSymbolicLink()) return "file_symlink";
      if (!stat.isDirectory()) return "parent_not_found";
      if (existsSync(join(parent, ".git"))) return "path_invalid";
    }
    const ignored = runGit(["check-ignore", "-q", "--", kind === "directory" ? `${path}/` : path], {
      cwd,
      allowFailure: true,
    });
    if (ignored.exitCode === 0) return "path_ignored";
    if (ignored.exitCode !== 1) throw new Error(ignored.stderr);
    const target = join(cwd, path);
    if (kind === "directory") mkdirSync(target);
    else
      closeSync(
        openSync(
          target,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o666,
        ),
      );
    return null;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "EEXIST") return "path_exists";
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return "parent_not_found";
      if (error.code === "ELOOP") return "file_symlink";
    }
    throw error;
  }
}
