import { parseViewSet, type SavedView, type ViewSet } from "@web/lib/issue/saved-view";
import { DEFAULT_ISSUES_VIEW_CONFIG } from "@web/lib/issue/view-config";
import { readScoped, writeScoped, type ScopedStorage } from "@web/lib/storage";

const ISSUE_VIEWS_KEY = "otomat.issue-views";

export const ALL_ISSUES_VIEW: SavedView = {
  id: "all-issues",
  name: "All issues",
  config: DEFAULT_ISSUES_VIEW_CONFIG,
};

export function readIssueViews(projectId: string, storage?: ScopedStorage | null): ViewSet {
  return readScoped(
    ISSUE_VIEWS_KEY,
    projectId,
    (raw) => parseViewSet(raw, ALL_ISSUES_VIEW),
    storage,
  );
}

export function writeIssueViews(
  projectId: string,
  set: ViewSet,
  storage?: ScopedStorage | null,
): void {
  writeScoped(ISSUE_VIEWS_KEY, projectId, { saved: set.saved, activeId: set.activeId }, storage);
}
