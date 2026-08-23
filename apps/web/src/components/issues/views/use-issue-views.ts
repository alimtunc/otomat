import {
  addView,
  emptyViewSet,
  moveView,
  removeView,
  renameView,
  selectView,
  storeViewConfig,
  type SavedView,
  type ViewSet,
} from "@web/lib/issue/saved-view";
import type { IssuesViewConfig } from "@web/lib/issue/view-config";
import { ALL_ISSUES_VIEW, readIssueViews, writeIssueViews } from "@web/lib/issue/view-storage";
import { useState } from "react";

export interface IssueViewsResult {
  set: ViewSet;
  select: (id: string) => void;
  create: (name: string, config: IssuesViewConfig) => SavedView;
  rename: (id: string, name: string) => void;
  store: (id: string, config: IssuesViewConfig) => void;
  remove: (id: string) => void;
  move: (id: string, offset: number) => void;
}

function newViewId(): string {
  return `view-${crypto.randomUUID()}`;
}

function storedViews(projectId: string | undefined): ViewSet {
  return projectId === undefined ? emptyViewSet(ALL_ISSUES_VIEW) : readIssueViews(projectId);
}

export function useIssueViews(projectId: string | undefined): IssueViewsResult {
  const [state, setState] = useState(() => ({ projectId, set: storedViews(projectId) }));
  if (state.projectId !== projectId) setState({ projectId, set: storedViews(projectId) });

  const commit = (set: ViewSet): void => {
    setState({ projectId, set });
    if (projectId !== undefined) writeIssueViews(projectId, set);
  };

  return {
    set: state.set,
    select: (id) => commit(selectView(state.set, id)),
    create: (name, config) => {
      const view = { id: newViewId(), name, config };
      commit(addView(state.set, view));
      return view;
    },
    rename: (id, name) => commit(renameView(state.set, id, name)),
    store: (id, config) => commit(storeViewConfig(state.set, id, config)),
    remove: (id) => commit(removeView(state.set, id)),
    move: (id, offset) => commit(moveView(state.set, id, offset)),
  };
}
