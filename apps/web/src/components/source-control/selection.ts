import type { DiffFileContract, SourceControlResponse } from "@otomat/domain";

export interface ActiveChange {
  staged: boolean;
  path: string;
}

/** The change to show: the one clicked, else the file the URL names, read from the unstaged group when it is there. */
export function selectedChange(
  data: SourceControlResponse,
  active: ActiveChange | null,
  fallbackPath: string | null,
): { current: ActiveChange; file: DiffFileContract } | null {
  const current =
    active ??
    (fallbackPath === null
      ? null
      : { path: fallbackPath, staged: !data.unstaged.some((file) => file.path === fallbackPath) });
  if (current === null) return null;
  const file = (current.staged ? data.staged : data.unstaged).find(
    (entry) => entry.path === current.path,
  );
  return file === undefined ? null : { current, file };
}
