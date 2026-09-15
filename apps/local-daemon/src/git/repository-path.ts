/** Anything that could name something outside the repository: an absolute path, a Windows/UNC root, a home shortcut, or a traversal segment. */
export function isRepositoryRelative(path: string): boolean {
  if (path === "" || path.startsWith("/") || path.startsWith("~") || path.startsWith("\\")) {
    return false;
  }
  if (/^[a-zA-Z]:[\\/]/.test(path)) return false;
  return !path.split(/[\\/]/).includes("..");
}

/** Strips the segments a picker adds without changing which file is named. */
export function normalizeRepositoryPath(path: string): string {
  return path.trim().replace(/^\.\//, "").replace(/\/+$/, "");
}
