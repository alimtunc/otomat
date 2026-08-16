import { asMember } from "@web/lib/coerce";
import { readScoped, writeScoped, type ScopedStorage } from "@web/lib/storage";

const ISSUES_LAYOUT_KEY = "otomat.issue-layout";

export const ISSUES_LAYOUTS = ["board", "list"] as const;
export type IssuesLayout = (typeof ISSUES_LAYOUTS)[number];

export const DEFAULT_ISSUES_LAYOUT: IssuesLayout = "board";

/** How a project is displayed, not what a saved view selects, so it outlives every view switch. */
export function readIssuesLayout(projectId: string, storage?: ScopedStorage | null): IssuesLayout {
  return readScoped(
    ISSUES_LAYOUT_KEY,
    projectId,
    (raw) => asMember(raw, ISSUES_LAYOUTS) ?? DEFAULT_ISSUES_LAYOUT,
    storage,
  );
}

export function writeIssuesLayout(
  projectId: string,
  layout: IssuesLayout,
  storage?: ScopedStorage | null,
): void {
  writeScoped(ISSUES_LAYOUT_KEY, projectId, layout, storage);
}
