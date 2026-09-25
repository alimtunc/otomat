import {
  Badge,
  cn,
  FOCUS_RING_INSET,
  HostTag,
  Icon,
  IconButton,
  ProjectGlyph,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@otomat/ui";
import type { ProjectTab } from "@web/components/shell/project-tabs/visible-tabs";

export interface OpenProjectTabProps {
  tab: ProjectTab;
  active: boolean;
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
}

export function OpenProjectTab({ tab, active, onSelect, onClose }: OpenProjectTabProps) {
  const trigger = (
    <button
      type="button"
      onClick={() => onSelect(tab.id)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-7 min-w-0 items-center gap-1.75 rounded-md pl-1 pr-1.5 text-sm",
        FOCUS_RING_INSET,
        active ? "text-foreground" : "text-text-secondary",
      )}
    >
      <ProjectGlyph name={tab.name} icon={tab.icon} />
      <span className="truncate">{tab.name}</span>
      {tab.tag === undefined ? null : <HostTag tag={tab.tag} />}
      {tab.attention ? <Badge variant="warning">{tab.attention}</Badge> : null}
    </button>
  );
  return (
    <div
      className={cn(
        "group flex h-7 max-w-52 flex-none items-center rounded-md pr-0.5",
        active ? "bg-selected" : "hover:bg-hover",
      )}
    >
      <Tooltip>
        <TooltipTrigger render={trigger} />
        <TooltipContent side="bottom">{tab.name}</TooltipContent>
      </Tooltip>
      <IconButton
        size="sm"
        label={`Close ${tab.name}`}
        icon={<Icon name="x" aria-hidden />}
        onClick={() => onClose(tab.id)}
        className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
      />
    </div>
  );
}
