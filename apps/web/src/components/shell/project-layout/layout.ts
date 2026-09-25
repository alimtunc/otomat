import { asProjectIcon, type ProjectIconName } from "@web/components/shell/project-layout/icons";
import { withItemMoved } from "@web/lib/array";
import { asBoolean, asRecord, asString, asStrings } from "@web/lib/coerce";
import { readStoredJson, writeStored } from "@web/lib/storage";

const PROJECT_LAYOUT_KEY = "otomat.project-layout";

export interface ProjectGroup {
  id: string;
  name: string;
  collapsed: boolean;
  projects: string[];
}

/** A key sits in at most one list. */
export interface ProjectLayout {
  ungrouped: string[];
  groups: ProjectGroup[];
  icons: Record<string, ProjectIconName>;
}

function parseProjectLayout(raw: unknown): ProjectLayout {
  const record = asRecord(raw);
  if (record === null) return { ungrouped: [], groups: [], icons: {} };
  const placed = new Set<string>();
  const keys = (value: unknown): string[] =>
    asStrings(value).filter((key) => {
      if (placed.has(key)) return false;
      placed.add(key);
      return true;
    });
  const ungrouped = keys(record["ungrouped"]);
  const groupIds = new Set<string>();
  const rawGroups = record["groups"];
  const groups = (Array.isArray(rawGroups) ? rawGroups : []).flatMap((entry): ProjectGroup[] => {
    const group = asRecord(entry);
    if (group === null) return [];
    const id = asString(group["id"]);
    const name = asString(group["name"]);
    if (id === null || name === null || name.trim() === "" || groupIds.has(id)) return [];
    groupIds.add(id);
    const collapsed = asBoolean(group["collapsed"]) ?? false;
    return [{ id, name, collapsed, projects: keys(group["projects"]) }];
  });
  const icons: Record<string, ProjectIconName> = {};
  for (const [key, value] of Object.entries(asRecord(record["icons"]) ?? {})) {
    const icon = asProjectIcon(value);
    if (icon !== null) icons[key] = icon;
  }
  return { ungrouped, groups, icons };
}

export function readStoredProjectLayout(storage?: Pick<Storage, "getItem"> | null): ProjectLayout {
  return readStoredJson(PROJECT_LAYOUT_KEY, parseProjectLayout, storage);
}

export function writeStoredProjectLayout(
  layout: ProjectLayout,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  writeStored(PROJECT_LAYOUT_KEY, JSON.stringify(layout), storage);
}

export function placedBefore(keys: string[], key: string, before: string | null): string[] {
  if (key === before) return keys;
  const rest = keys.filter((entry) => entry !== key);
  const index = before === null ? -1 : rest.indexOf(before);
  return index === -1 ? [...rest, key] : [...rest.slice(0, index), key, ...rest.slice(index)];
}

export function withSectionOrder(
  layout: ProjectLayout,
  groupId: string | null,
  keys: string[],
): ProjectLayout {
  if (groupId !== null && !layout.groups.some((group) => group.id === groupId)) return layout;
  const listed = new Set(keys);
  const rest = (list: string[]): string[] => list.filter((key) => !listed.has(key));
  const ordered = (list: string[]): string[] => [...keys, ...rest(list)];
  return {
    ...layout,
    ungrouped: groupId === null ? ordered(layout.ungrouped) : rest(layout.ungrouped),
    groups: layout.groups.map((group) => ({
      ...group,
      projects: group.id === groupId ? ordered(group.projects) : rest(group.projects),
    })),
  };
}

export function withGroup(layout: ProjectLayout, id: string, name: string): ProjectLayout {
  return { ...layout, groups: [...layout.groups, { id, name, collapsed: false, projects: [] }] };
}

export function withGroupName(layout: ProjectLayout, id: string, name: string): ProjectLayout {
  return {
    ...layout,
    groups: layout.groups.map((group) => (group.id === id ? { ...group, name } : group)),
  };
}

export function withGroupToggled(layout: ProjectLayout, id: string): ProjectLayout {
  return {
    ...layout,
    groups: layout.groups.map((group) =>
      group.id === id ? { ...group, collapsed: !group.collapsed } : group,
    ),
  };
}

export function withGroupMoved(layout: ProjectLayout, id: string, offset: number): ProjectLayout {
  const from = layout.groups.findIndex((group) => group.id === id);
  const groups = withItemMoved(layout.groups, from, offset);
  return groups === null ? layout : { ...layout, groups };
}

export function withoutGroup(layout: ProjectLayout, id: string): ProjectLayout {
  const removed = layout.groups.find((group) => group.id === id);
  if (removed === undefined) return layout;
  return {
    ...layout,
    ungrouped: [...layout.ungrouped, ...removed.projects],
    groups: layout.groups.filter((group) => group !== removed),
  };
}

export function withProjectIcon(
  layout: ProjectLayout,
  key: string,
  icon: ProjectIconName | null,
): ProjectLayout {
  const icons = Object.fromEntries(Object.entries(layout.icons).filter(([entry]) => entry !== key));
  return { ...layout, icons: icon === null ? icons : { ...icons, [key]: icon } };
}
