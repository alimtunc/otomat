import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  isEditableTarget,
} from "@otomat/ui";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { WORKSPACE_NAV } from "@web/components/shell/nav-items";
import { confirmContextNavigation } from "@web/lib/context-navigation";
import { useEffect, useEffectEvent, useRef } from "react";

import {
  addDeskTab,
  closeDeskTab,
  currentDeskPage,
  isDeskRoute,
  moveDeskTab,
  PROJECT_HOME,
} from "./state";
import { getProjectDesk, projectDeskStore } from "./store";
import { DeskTabItem } from "./tab";

export function DeskTabsBar({ projectKey }: { projectKey: string }) {
  const stored = useSelector(projectDeskStore, (state) => state.desks[projectKey]);
  const desk = stored ?? getProjectDesk(projectKey);
  const navigate = useNavigate();
  const href = useRouterState({ select: (state) => state.location.href });
  const ref = useRef<HTMLElement>(null);
  const scoped = isDeskRoute(href);
  const go = (target: string) => {
    projectDeskStore.actions.expect(projectKey, target);
    void navigate({ href: target });
  };
  const focusTab = (id: string | null) =>
    requestAnimationFrame(() => {
      const target =
        id === null
          ? ref.current?.querySelector<HTMLButtonElement>('[aria-label="New tab"]')
          : ref.current?.querySelector<HTMLButtonElement>(`[data-desk-tab="${CSS.escape(id)}"]`);
      target?.focus();
      target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  const select = (id: string) => {
    if (desk.active === id && scoped) return false;
    if (!confirmContextNavigation()) return false;
    const tab = desk.tabs.find((entry) => entry.id === id);
    if (tab === undefined) return false;
    projectDeskStore.actions.edit(projectKey, (current) => ({ ...current, active: id }));
    go(tab.href);
    return true;
  };
  const adjacent = (id: string, offset: number) => {
    const next =
      desk.tabs[
        (desk.tabs.findIndex((tab) => tab.id === id) + offset + desk.tabs.length) % desk.tabs.length
      ];
    if (next !== undefined) {
      if (select(next.id)) focusTab(next.id);
    }
  };
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      !scoped ||
      event.defaultPrevented ||
      event.key !== "Tab" ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      isEditableTarget(event.target)
    )
      return;
    if (event.target instanceof Element && event.target.closest('[role="dialog"], [role="menu"]'))
      return;
    if (desk.active === null) return;
    event.preventDefault();
    adjacent(desk.active, event.shiftKey ? -1 : 1);
  });
  // otomat-allow-effect: keyboard navigation follows the active project's manually opened tabs.
  useEffect(() => {
    const handle = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  if (!scoped) return null;
  const activeId = desk.active;
  const index = desk.tabs.findIndex((tab) => tab.id === desk.active);
  return (
    <nav
      ref={ref}
      aria-label="Project tabs"
      className="flex min-h-9 min-w-0 shrink-0 items-center border-b border-border-subtle bg-surface-1"
    >
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {desk.tabs.map((tab) => (
          <DeskTabItem
            key={tab.id}
            tab={tab}
            active={desk.active === tab.id}
            onSelect={() => select(tab.id)}
            onAdjacent={(offset) => adjacent(tab.id, offset)}
            onMove={(offset) =>
              projectDeskStore.actions.edit(projectKey, (current) =>
                moveDeskTab(current, tab.id, offset),
              )
            }
            onClose={() => {
              if (desk.active === tab.id && !confirmContextNavigation()) return;
              const next = closeDeskTab(desk, tab.id);
              projectDeskStore.actions.edit(projectKey, () => next);
              if (desk.active === tab.id) go(currentDeskPage(next).href);
              focusTab(next.active);
            }}
            onDrop={(id) => {
              const from = desk.tabs.findIndex((entry) => entry.id === id);
              const to = desk.tabs.findIndex((entry) => entry.id === tab.id);
              if (from !== -1)
                projectDeskStore.actions.edit(projectKey, (current) =>
                  moveDeskTab(current, id, to - from),
                );
            }}
          />
        ))}
        {desk.tabs.length === 0 ? (
          <span className="truncate px-3 text-xs text-text-tertiary">{desk.page.label}</span>
        ) : null}
      </div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={<IconButton label="New tab" icon={<Icon name="plus" aria-hidden />} />}
        />
        <DropdownMenuContent align="end" className="w-56" style={{ transition: "none" }}>
          {[
            { to: PROJECT_HOME.href, label: PROJECT_HOME.label, icon: "folder" as const },
            ...WORKSPACE_NAV,
          ].map((item) => (
            <DropdownMenuItem
              key={item.to}
              onClick={() => {
                if (!confirmContextNavigation()) return;
                const page = { href: item.to, label: item.label };
                projectDeskStore.actions.edit(projectKey, (current) =>
                  addDeskTab(current, crypto.randomUUID(), page),
                );
                go(item.to);
              }}
            >
              <Icon name={item.icon} aria-hidden />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <IconButton
              label="Tab actions"
              disabled={desk.active === null}
              icon={<Icon name="more-horizontal" aria-hidden />}
            />
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={index <= 0}
            onClick={() => {
              if (activeId !== null)
                projectDeskStore.actions.edit(projectKey, (current) =>
                  moveDeskTab(current, activeId, -1),
                );
            }}
          >
            Move tab left
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index < 0 || index === desk.tabs.length - 1}
            onClick={() => {
              if (activeId !== null)
                projectDeskStore.actions.edit(projectKey, (current) =>
                  moveDeskTab(current, activeId, 1),
                );
            }}
          >
            Move tab right
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
