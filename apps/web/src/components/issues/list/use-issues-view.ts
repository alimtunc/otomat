import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  hasOverrides,
  issuesConfigFromSearch,
  issuesSearchFromConfig,
} from "@web/components/issues/list/search";
import { useIssueViews, type IssueViewsResult } from "@web/components/issues/views/use-issue-views";
import type { SavedView } from "@web/lib/issue/saved-view";
import { findView } from "@web/lib/issue/saved-view";
import type { IssuesViewConfig } from "@web/lib/issue/view-config";

export interface IssuesViewResult {
  views: IssueViewsResult;
  active: SavedView;
  config: IssuesViewConfig;
  dirty: boolean;
  openView: (viewId: string) => void;
  /** Drops every override the URL carries, leaving exactly what the active view saved. */
  reset: () => void;
  refine: (patch: Partial<IssuesViewConfig>) => void;
  toggleGroup: (key: string) => void;
}

export function useIssuesView(projectId: string | undefined): IssuesViewResult {
  const search = useSearch({ from: "/issues/" });
  const navigate = useNavigate({ from: "/issues/" });
  const views = useIssueViews(projectId);
  const active = findView(views.set, search.view ?? views.set.activeId);
  const config = issuesConfigFromSearch(active.config, search);

  const openView = (viewId: string): void => {
    void navigate({ to: "/issues", search: { view: viewId }, replace: true });
  };

  const refine = (patch: Partial<IssuesViewConfig>): void => {
    const next = { ...config, ...patch };
    // Collapsed keys name the groups of one axis; another axis has none of them.
    if (patch.grouping !== undefined && patch.grouping !== config.grouping) {
      next.collapsedGroups = [];
    }
    void navigate({
      to: "/issues",
      search: { view: active.id, ...issuesSearchFromConfig(active.config, next) },
      replace: true,
    });
  };

  return {
    views,
    active,
    config,
    dirty: hasOverrides(issuesSearchFromConfig(active.config, config)),
    openView,
    reset: () => openView(active.id),
    refine,
    toggleGroup: (key) =>
      refine({
        collapsedGroups: config.collapsedGroups.includes(key)
          ? config.collapsedGroups.filter((entry) => entry !== key)
          : [...config.collapsedGroups, key].toSorted(),
      }),
  };
}
