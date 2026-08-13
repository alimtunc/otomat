import { CONTEXT_FILE_MAX_BYTES, type ContextFile } from "@otomat/domain";

import type { TreeSnapshot } from "#git";

/** Anything that could name something outside the repository: an absolute path, a Windows/UNC root, a home shortcut, or a traversal segment. */
function isRepositoryRelative(path: string): boolean {
  if (path === "" || path.startsWith("/") || path.startsWith("~") || path.startsWith("\\")) {
    return false;
  }
  if (/^[a-zA-Z]:[\\/]/.test(path)) return false;
  return !path.split(/[\\/]/).includes("..");
}

/** Strips the segments a picker adds without changing which file is named. */
function normalizeContextPath(path: string): string {
  return path.trim().replace(/^\.\//, "").replace(/\/+$/, "");
}

/** Refusing a symlink is what keeps an attached path from reading a host file the repository merely points at. */
export function readContextFile(snapshot: TreeSnapshot, rawPath: string): ContextFile {
  const path = normalizeContextPath(rawPath);
  if (!isRepositoryRelative(path))
    return { state: "unavailable", path, reason: "outside_repository" };
  const read = snapshot.readFile(path, { maxBytes: CONTEXT_FILE_MAX_BYTES });
  switch (read.kind) {
    case "text":
      return { state: "read", path, bytes: read.bytes, text: read.text };
    case "symlink":
      return { state: "unavailable", path, reason: "symlink" };
    case "binary":
      return { state: "unavailable", path, reason: "binary" };
    case "too_large":
      return { state: "unavailable", path, reason: "too_large" };
    case "directory":
      return { state: "unavailable", path, reason: "unreadable" };
    case "missing":
      return { state: "unavailable", path, reason: "missing" };
  }
}
