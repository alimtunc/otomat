import type { PullRequestInboxGroup } from "@otomat/domain";
import type { InboxFilters } from "@web/lib/pull-request/inbox/filters";
import {
  parseInboxViewConfig,
  readInboxView,
  writeInboxView,
  type InboxViewConfig,
} from "@web/lib/pull-request/inbox/view";
import { useState } from "react";

export interface InboxViewResult {
  config: InboxViewConfig;
  setFilters: (filters: InboxFilters) => void;
  toggleGroup: (group: PullRequestInboxGroup) => void;
}

function storedView(projectId: string | undefined): InboxViewConfig {
  return projectId === undefined ? parseInboxViewConfig(null) : readInboxView(projectId);
}

export function useInboxView(projectId: string | undefined): InboxViewResult {
  const [state, setState] = useState(() => ({ projectId, config: storedView(projectId) }));
  if (state.projectId !== projectId) setState({ projectId, config: storedView(projectId) });

  const commit = (config: InboxViewConfig): void => {
    setState({ projectId, config });
    if (projectId !== undefined) writeInboxView(projectId, config);
  };

  return {
    config: state.config,
    setFilters: (filters) => commit({ ...state.config, filters }),
    toggleGroup: (group) =>
      commit({
        ...state.config,
        collapsedGroups: state.config.collapsedGroups.includes(group)
          ? state.config.collapsedGroups.filter((entry) => entry !== group)
          : [...state.config.collapsedGroups, group].toSorted(),
      }),
  };
}
