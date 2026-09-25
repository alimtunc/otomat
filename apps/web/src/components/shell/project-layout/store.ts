import { createStore } from "@tanstack/react-store";
import type { ProjectIconName } from "@web/components/shell/project-layout/icons";
import {
  readStoredProjectLayout,
  withGroup,
  withGroupMoved,
  withGroupName,
  withGroupToggled,
  withoutGroup,
  withProjectIcon,
  withSectionOrder,
  writeStoredProjectLayout,
  type ProjectLayout,
} from "@web/components/shell/project-layout/layout";

export const projectLayoutStore = createStore(readStoredProjectLayout(), ({ setState }) => {
  const apply = (edit: (layout: ProjectLayout) => ProjectLayout): void => {
    setState((layout) => {
      const next = edit(layout);
      if (next !== layout) writeStoredProjectLayout(next);
      return next;
    });
  };
  return {
    orderSection(groupId: string | null, keys: string[]): void {
      apply((layout) => withSectionOrder(layout, groupId, keys));
    },
    addGroup(name: string): void {
      apply((layout) => withGroup(layout, `group-${crypto.randomUUID()}`, name));
    },
    renameGroup(id: string, name: string): void {
      apply((layout) => withGroupName(layout, id, name));
    },
    toggleGroup(id: string): void {
      apply((layout) => withGroupToggled(layout, id));
    },
    moveGroup(id: string, offset: number): void {
      apply((layout) => withGroupMoved(layout, id, offset));
    },
    removeGroup(id: string): void {
      apply((layout) => withoutGroup(layout, id));
    },
    setIcon(key: string, icon: ProjectIconName | null): void {
      apply((layout) => withProjectIcon(layout, key, icon));
    },
  };
});
