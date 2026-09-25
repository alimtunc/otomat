import type { ProjectSection, ProjectSummary } from "@otomat/ui";
import type { ProjectGroup, ProjectLayout } from "@web/components/shell/project-layout/layout";

export interface ArrangedSection<T> {
  group: ProjectGroup | null;
  items: T[];
}

export function arrangeProjects<T extends { id: string }>(
  layout: ProjectLayout,
  items: T[],
): ArrangedSection<T>[] {
  const known = new Map(items.map((item) => [item.id, item]));
  const pick = (keys: string[]): T[] =>
    keys.flatMap((key) => {
      const item = known.get(key);
      return item === undefined ? [] : [item];
    });
  const placed = new Set([
    ...layout.ungrouped,
    ...layout.groups.flatMap((group) => group.projects),
  ]);
  return [
    {
      group: null,
      items: [...pick(layout.ungrouped), ...items.filter((item) => !placed.has(item.id))],
    },
    ...layout.groups.map((group) => ({ group, items: pick(group.projects) })),
  ];
}

export function withLayoutIcons(
  layout: ProjectLayout,
  projects: ProjectSummary[],
): ProjectSummary[] {
  return projects.map((project) => ({ ...project, icon: layout.icons[project.id] }));
}

export function switcherSections(
  layout: ProjectLayout,
  projects: ProjectSummary[],
): ProjectSection[] {
  return arrangeProjects(layout, withLayoutIcons(layout, projects)).map(({ group, items }) => ({
    id: group?.id ?? "ungrouped",
    label: group?.name,
    items,
  }));
}
