import type { DiffFileContract } from "@otomat/domain";

const ROOT = "/";

export function pathSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment !== "");
}

export function baseName(path: string): string {
  return pathSegments(path).pop() ?? path;
}

function directoryName(path: string): string {
  return pathSegments(path).slice(0, -1).join("/");
}

export interface DiffFileLabels {
  /** Basename of the new path, or `old.ts → new.ts` when a rename changed it. */
  name: string;
  /** Parent directory of the new path; empty at the repository root. */
  directory: string;
  /** `oldDir → newDir` when a rename moved the file across directories, else null. */
  move: string | null;
  /** The whole change on one line: the path, or `oldPath → newPath` for a rename. */
  full: string;
}

/**
 * Splits a changed file into the basename a row always shows and the secondary
 * detail it may ellipsize, keeping renames legible in both halves.
 */
export function diffFileLabels(file: Pick<DiffFileContract, "path" | "old_path">): DiffFileLabels {
  const name = baseName(file.path);
  const directory = directoryName(file.path);
  const renamedFrom = file.old_path !== null && file.old_path !== file.path ? file.old_path : null;
  if (renamedFrom === null) return { name, directory, move: null, full: file.path };
  const oldName = baseName(renamedFrom);
  const oldDirectory = directoryName(renamedFrom);
  const moved = `${oldDirectory || ROOT} → ${directory || ROOT}`;
  return {
    name: oldName === name ? name : `${oldName} → ${name}`,
    directory,
    move: oldDirectory === directory ? null : moved,
    full: `${renamedFrom} → ${file.path}`,
  };
}
