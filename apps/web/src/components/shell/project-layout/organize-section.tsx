import type { ProjectSummary } from "@otomat/ui";
import type { ArrangedSection } from "@web/components/shell/project-layout/arrange";
import { acceptProjectDrop, allowProjectDrop } from "@web/components/shell/project-layout/drag";
import { GroupHeader } from "@web/components/shell/project-layout/group-header";
import { placedBefore, type ProjectGroup } from "@web/components/shell/project-layout/layout";
import { ProjectRow } from "@web/components/shell/project-layout/project-row";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";
import { withItemMoved } from "@web/lib/array";

export interface OrganizeSectionProps {
  section: ArrangedSection<ProjectSummary>;
  groups: ProjectGroup[];
  onGroupChange: (key: string, groupId: string | null) => void;
}

export function OrganizeSection({ section, groups, onGroupChange }: OrganizeSectionProps) {
  const { group, items } = section;
  const actions = projectLayoutStore.actions;
  const groupId = group?.id ?? null;
  const keys = items.map((project) => project.id);
  const place = (key: string, before: string | null): void => {
    actions.orderSection(groupId, placedBefore(keys, key, before));
  };

  return (
    <section
      aria-label={group?.name ?? "Not grouped"}
      onDragOver={allowProjectDrop}
      onDrop={(event) => {
        const key = acceptProjectDrop(event);
        if (key !== null) place(key, null);
      }}
      className="flex flex-col gap-1"
    >
      {group === null ? (
        <h3 className="px-1.5 text-micro font-semibold text-text-tertiary">Not grouped</h3>
      ) : (
        <GroupHeader
          group={group}
          canMoveUp={groups[0] !== group}
          canMoveDown={groups.at(-1) !== group}
          onRename={(name) => actions.renameGroup(group.id, name)}
          onMove={(offset) => actions.moveGroup(group.id, offset)}
          onRemove={() => actions.removeGroup(group.id)}
        />
      )}
      {items.length === 0 ? (
        <p className="px-1.5 text-xs text-text-tertiary">
          {group === null
            ? "Every project is in a group."
            : "Choose this group on a project, or drag one here."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((project, index) => (
            <ProjectRow
              key={project.id}
              project={project}
              groupId={groupId}
              groups={groups}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onMove={(offset) => {
                const next = withItemMoved(keys, index, offset);
                if (next !== null) actions.orderSection(groupId, next);
              }}
              onGroupChange={(target) => onGroupChange(project.id, target)}
              onIconChange={(icon) => actions.setIcon(project.id, icon)}
              onDropProject={(key) => place(key, project.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
