import type { ProjectSummary } from "@otomat/ui";
import type { StoredProjectTab } from "@web/components/shell/project-tabs/state";

export interface ProjectTab {
  id: string;
  name: string;
  tag?: string;
  /** Unresolved Inbox entries for the project; absent while its host is not the connected one. */
  attention?: number;
}

export interface VisibleProjectTabsInput {
  stored: StoredProjectTab[];
  projects: ProjectSummary[];
  attention: Map<string, number>;
}

export function visibleProjectTabs(input: VisibleProjectTabsInput): ProjectTab[] {
  const known = new Map(input.projects.map((project) => [project.id, project]));
  return input.stored.flatMap((storedTab) => {
    const project = known.get(storedTab.key);
    if (project === undefined) return [];
    const tab: ProjectTab = { id: storedTab.key, name: project.name };
    if (project.tag !== undefined) tab.tag = project.tag;
    const attention = input.attention.get(storedTab.key);
    if (attention !== undefined) tab.attention = attention;
    return [tab];
  });
}
