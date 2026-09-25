import {
  HostTag,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type ProjectSummary,
} from "@otomat/ui";
import { acceptProjectDrop, startProjectDrag } from "@web/components/shell/project-layout/drag";
import { ProjectIconMenu } from "@web/components/shell/project-layout/icon-menu";
import type { ProjectIconName } from "@web/components/shell/project-layout/icons";
import type { ProjectGroup } from "@web/components/shell/project-layout/layout";
import {
  MoveButtons,
  type MoveButtonsProps,
} from "@web/components/shell/project-layout/move-buttons";

const NO_GROUP = "none";

export interface ProjectRowProps {
  project: ProjectSummary;
  groupId: string | null;
  groups: ProjectGroup[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: MoveButtonsProps["onMove"];
  onGroupChange: (groupId: string | null) => void;
  onIconChange: (icon: ProjectIconName | null) => void;
  onDropProject: (key: string) => void;
}

export function ProjectRow({
  project,
  groupId,
  groups,
  canMoveUp,
  canMoveDown,
  onMove,
  onGroupChange,
  onIconChange,
  onDropProject,
}: ProjectRowProps) {
  const options = [
    { value: NO_GROUP, label: "Not grouped" },
    ...groups.map((group) => ({ value: group.id, label: group.name })),
  ];
  return (
    <li
      draggable
      onDragStart={(event) => startProjectDrag(event, project.id)}
      onDrop={(event) => {
        const key = acceptProjectDrop(event);
        if (key !== null) onDropProject(key);
      }}
      className="flex cursor-grab items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover"
    >
      <ProjectIconMenu name={project.name} icon={project.icon} onChange={onIconChange} />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{project.name}</span>
      {project.tag === undefined ? null : <HostTag tag={project.tag} />}
      <Select
        items={options}
        value={groupId ?? NO_GROUP}
        onValueChange={(next) => {
          const target = next === NO_GROUP ? null : next;
          if (next !== null && target !== groupId) onGroupChange(target);
        }}
      >
        <SelectTrigger aria-label={`Group for ${project.name}`} className="h-7 w-36 flex-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <MoveButtons
        label={project.name}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMove={onMove}
      />
    </li>
  );
}
