import { lstatSync } from "node:fs";
import { join } from "node:path";

import { isRepositoryRelative } from "../repository-path.js";
import { SourceControlError } from "./errors.js";

export function assertChangePath(cwd: string, path: string): void {
  const segments = path.split("/");
  if (
    !isRepositoryRelative(path) ||
    segments.includes(".git") ||
    segments.some((segment) => segment === "" || segment === ".")
  ) {
    throw new SourceControlError("path_invalid", "The path must name a file inside this checkout.");
  }
  let parent = cwd;
  for (const segment of segments.slice(0, -1)) {
    parent = join(parent, segment);
    let stat;
    try {
      stat = lstatSync(parent);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new SourceControlError(
        "path_invalid",
        "Changes through a symlink or non-directory parent are refused.",
      );
  }
}
