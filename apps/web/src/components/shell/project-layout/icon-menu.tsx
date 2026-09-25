import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  ProjectGlyph,
  type IconName,
} from "@otomat/ui";
import {
  asProjectIcon,
  PROJECT_ICONS,
  type ProjectIconName,
} from "@web/components/shell/project-layout/icons";

const DEFAULT_ICON = "default";

export interface ProjectIconMenuProps {
  name: string;
  icon: IconName | undefined;
  onChange: (icon: ProjectIconName | null) => void;
}

export function ProjectIconMenu({ name, icon, onChange }: ProjectIconMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            size="sm"
            label={`Icon for ${name}`}
            icon={<ProjectGlyph name={name} icon={icon} />}
          />
        }
      />
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={icon ?? DEFAULT_ICON}
          onValueChange={(next) => onChange(asProjectIcon(next))}
        >
          <DropdownMenuRadioItem value={DEFAULT_ICON} closeOnClick>
            Default icon
          </DropdownMenuRadioItem>
          {PROJECT_ICONS.map((choice) => (
            <DropdownMenuRadioItem key={choice.name} value={choice.name} closeOnClick>
              <Icon name={choice.name} aria-hidden />
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
