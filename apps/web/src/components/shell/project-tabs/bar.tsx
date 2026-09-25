import { ProjectGroupChip } from "@web/components/shell/project-tabs/group-chip";
import { OpenProjectTab } from "@web/components/shell/project-tabs/tab";
import { useProjectTabs } from "@web/components/shell/project-tabs/use-project-tabs";
import { useProjectTabShortcuts } from "@web/components/shell/project-tabs/use-tab-shortcuts";
import type { ProjectTab } from "@web/components/shell/project-tabs/visible-tabs";
import { Fragment } from "react";

export function ProjectTabsBar() {
  const { sections, tabs, activeKey, select, close, toggleGroup } = useProjectTabs();
  useProjectTabShortcuts(tabs, activeKey, select);
  if (tabs.length === 0) return null;

  const renderTab = (tab: ProjectTab) => (
    <OpenProjectTab
      key={tab.id}
      tab={tab}
      active={tab.id === activeKey}
      onSelect={select}
      onClose={close}
    />
  );

  return (
    <nav
      aria-label="Open projects"
      className="flex h-9.5 flex-none items-center gap-1 overflow-x-auto border-b border-border-subtle bg-surface-1 px-2"
    >
      {sections.map(({ group, items }) => {
        if (group === null) return <Fragment key="ungrouped">{items.map(renderTab)}</Fragment>;
        if (items.length === 0) return null;
        const shown = group.collapsed ? items.filter((tab) => tab.id === activeKey) : items;
        return (
          <div
            key={group.id}
            role="group"
            aria-label={group.name}
            className="flex flex-none items-center gap-1 rounded-lg border border-border-subtle p-px"
          >
            <ProjectGroupChip
              name={group.name}
              collapsed={group.collapsed}
              hiddenTabs={items.filter((tab) => !shown.includes(tab))}
              onToggle={() => toggleGroup(group.id)}
            />
            {shown.map(renderTab)}
          </div>
        );
      })}
    </nav>
  );
}
