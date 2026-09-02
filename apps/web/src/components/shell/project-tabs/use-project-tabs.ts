import { countOpenInboxEntriesByProject } from "@otomat/domain";
import { useRouterState } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { projectSwitcherKey } from "@web/components/shell/project-selection/host-key";
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { useOpenHostInboxes } from "@web/components/shell/project-tabs/use-open-host-inboxes";
import {
  visibleProjectTabs,
  type ProjectTab,
} from "@web/components/shell/project-tabs/visible-tabs";
import { isProjectRoute } from "@web/lib/project-navigation";
import { useEffect } from "react";

export interface ProjectTabsView {
  tabs: ProjectTab[];
  activeKey: string | undefined;
  select: (key: string) => void;
  close: (key: string) => void;
}

export function useProjectTabs(): ProjectTabsView {
  const switcher = useProjectSwitcher();
  const stored = useSelector(projectTabsStore);
  const inboxes = useOpenHostInboxes();
  const href = useRouterState({ select: (state) => state.location.href });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeKey = switcher.currentSwitcherId;

  const attention = new Map(
    inboxes.flatMap(({ host, entries }) =>
      [...countOpenInboxEntriesByProject(entries)].map(
        ([projectId, count]) => [projectSwitcherKey(host, projectId), count] as const,
      ),
    ),
  );
  const tabs = visibleProjectTabs({ stored, projects: switcher.projects, attention });

  // otomat-allow-effect: the committed location is the router's state, not a result of this render.
  useEffect(() => {
    if (activeKey === undefined || !isProjectRoute(pathname)) return;
    projectTabsStore.actions.recordRoute(activeKey, href);
  }, [activeKey, href, pathname]);

  return {
    tabs,
    activeKey,
    select: switcher.selectProject,
    close: projectTabsStore.actions.close,
  };
}
