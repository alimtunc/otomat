import type { ChangeStatus, SourceControlResponse, WorktreeFileEntry } from "@otomat/domain";

export type DecoratedFile = Pick<WorktreeFileEntry, "path" | "kind"> & { status?: ChangeStatus };

export function decorateFiles(
  entries: readonly WorktreeFileEntry[],
  changes?: SourceControlResponse,
) {
  const files = new Map<string, DecoratedFile>(
    entries.map((entry) => [entry.path, { path: entry.path, kind: entry.kind }]),
  );
  for (const change of [...(changes?.staged ?? []), ...(changes?.unstaged ?? [])]) {
    const entry = files.get(change.path);
    const status =
      entry?.status === "added" && change.status === "modified" ? "added" : change.status;
    if (entry !== undefined) files.set(change.path, { ...entry, status });
    else if (status === "deleted")
      files.set(change.path, { path: change.path, kind: "file", status });
  }
  const directories = new Map<string, ChangeStatus>();
  for (const file of files.values()) {
    if (file.status === undefined) continue;
    const parts = file.path.split("/");
    for (let length = 1; length < parts.length; length++) {
      const path = parts.slice(0, length).join("/");
      const existing = directories.get(path);
      directories.set(
        path,
        existing === undefined || existing === file.status ? file.status : "modified",
      );
    }
  }
  return { files: [...files.values()], directories };
}
