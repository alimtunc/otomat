import {
  Badge,
  cn,
  FOCUS_RING,
  HostTag,
  Icon,
  IconButton,
  ProjectGlyph,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@otomat/ui";
import { useProjectTabs } from "@web/components/shell/project-tabs/use-project-tabs";
import { useProjectTabShortcuts } from "@web/components/shell/project-tabs/use-tab-shortcuts";

export function ProjectTabsBar() {
  const { tabs, activeKey, select, close } = useProjectTabs();
  useProjectTabShortcuts(tabs, activeKey, select);
  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label="Open projects"
      className="flex h-9.5 flex-none items-center gap-1 overflow-x-auto border-b border-border-subtle bg-surface-1 px-2"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeKey;
        const trigger = (
          <button
            type="button"
            onClick={() => select(tab.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-7 min-w-0 items-center gap-1.75 rounded-md pl-1 pr-1.5 text-sm",
              FOCUS_RING,
              "focus-visible:outline-offset-[-2px]",
              active ? "text-foreground" : "text-text-secondary",
            )}
          >
            <ProjectGlyph name={tab.name} />
            <span className="truncate">{tab.name}</span>
            {tab.tag === undefined ? null : <HostTag tag={tab.tag} />}
            {tab.attention ? <Badge variant="iris">{tab.attention}</Badge> : null}
          </button>
        );
        return (
          <div
            key={tab.id}
            className={cn(
              "group flex h-7 max-w-52 flex-none items-center rounded-md pr-0.5",
              active ? "bg-selected" : "hover:bg-hover",
            )}
          >
            <Tooltip>
              <TooltipTrigger render={trigger} />
              <TooltipContent side="bottom">{tab.name}</TooltipContent>
            </Tooltip>
            {tabs.length > 1 ? (
              <IconButton
                size="sm"
                label={`Close ${tab.name}`}
                icon={<Icon name="x" aria-hidden />}
                onClick={() => close(tab.id)}
                className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
              />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
