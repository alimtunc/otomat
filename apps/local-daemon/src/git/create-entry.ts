import { closeSync, constants, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";

import type {
  CreateWorktreeEntryRequest,
  WorktreeFileEntry,
  WorktreeFileError,
} from "@otomat/domain";

import { isPathAbsent, parentRefusal } from "./file-write.js";
import { isIgnored } from "./ignored-file.js";

/** `path` must already pass `isCreatableRepositoryPath`; a symlinked parent is refused because the entry would land where the tree does not show it. */
export function createWorktreeEntry(
  cwd: string,
  { path, kind }: CreateWorktreeEntryRequest,
): WorktreeFileEntry | WorktreeFileError {
  const parentError = parentRefusal(cwd, path);
  if (parentError !== null) return parentError;
  const ignored = isIgnored(cwd, kind === "directory" ? `${path}/` : path);
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
  return { path, kind, size: 0, ignored };
}
