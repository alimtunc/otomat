export interface FilesSearch {
  changes?: true;
  file?: string;
  fileScope?: string;
}

export function parseFilesSearch(search: Record<string, unknown>): FilesSearch {
  return {
    changes: search.changes === true || search.changes === "true" ? true : undefined,
    file: typeof search.file === "string" ? search.file : undefined,
    fileScope: typeof search.fileScope === "string" ? search.fileScope : undefined,
  };
}
