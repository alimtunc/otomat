import { CONTEXT_FILE_MAX_BYTES, type ContextFile } from "@otomat/domain";

import { isRepositoryRelative, normalizeRepositoryPath, type TreeSnapshot } from "#git";

/** Refusing a symlink is what keeps an attached path from reading a host file the repository merely points at. */
export async function readContextFile(
  snapshot: TreeSnapshot,
  rawPath: string,
): Promise<ContextFile> {
  const path = normalizeRepositoryPath(rawPath);
  if (!isRepositoryRelative(path))
    return { state: "unavailable", path, reason: "outside_repository" };
  const read = await snapshot.readFile(path, { maxBytes: CONTEXT_FILE_MAX_BYTES });
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
