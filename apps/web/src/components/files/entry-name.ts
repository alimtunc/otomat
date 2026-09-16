import type { WorktreeFileEntry } from "@otomat/domain";
import { joinPath } from "@web/components/files/tree/path";

export function entryNameError(
  name: string,
  directory: string,
  entries: readonly WorktreeFileEntry[],
  label: string,
): string | undefined {
  if (name === "") return `Enter a ${label} name.`;
  if (name.toLowerCase() === ".git") {
    return "The name .git is reserved by Git. Names like .gitignore are allowed.";
  }
  if (/[\\/\0]/.test(name) || name === "." || name === "..") {
    return "Choose a name without slashes, other than . or ...";
  }
  const path = joinPath(directory, name);
  if (entries.some((entry) => entry.path === path || entry.path.startsWith(`${path}/`))) {
    return `A file or folder named ${name} already exists here. Choose a different name.`;
  }
  return undefined;
}
