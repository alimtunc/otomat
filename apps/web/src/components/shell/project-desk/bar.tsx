import { isEditableTarget, isOverlayTarget } from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { confirmContextNavigation } from "@web/lib/context-navigation";
import { useEffect, useEffectEvent, useRef } from "react";

import { NewTabMenu } from "./new-tab-menu";
import { activateDeskTab, addDeskTab, closeDeskTab, moveDeskTab, type DeskPage } from "./state";
import { getProjectDesk, projectDeskStore } from "./store";
import { DeskTabItem } from "./tab";
import { TabActionsMenu } from "./tab-actions-menu";

export function DeskTabsBar({ projectKey }: { projectKey: string }) {
  const stored = useSelector(projectDeskStore, (state) => state.desks[projectKey]);
  const desk = stored ?? getProjectDesk(projectKey);
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const newTabRef = useRef<HTMLButtonElement>(null);
  const go = (target: string) => {
    projectDeskStore.actions.expect(projectKey, target);
    void navigate({ href: target });
  };
  const focusTab = (id: string | null) =>
    requestAnimationFrame(() => {
      const target =
        id === null
          ? newTabRef.current
          : ref.current?.querySelector<HTMLButtonElement>(`[data-desk-tab="${CSS.escape(id)}"]`);
      target?.focus();
      target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  const select = (id: string) => {
    if (desk.active === id) return false;
    if (!confirmContextNavigation()) return false;
    const tab = desk.tabs.find((entry) => entry.id === id);
    if (tab === undefined) return false;
    projectDeskStore.actions.edit(projectKey, (current) => activateDeskTab(current, id));
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
  const move = (id: string, offset: number) =>
    projectDeskStore.actions.edit(projectKey, (current) => moveDeskTab(current, id, offset));
  const open = (page: DeskPage) => {
    if (!confirmContextNavigation()) return;
    projectDeskStore.actions.edit(projectKey, (current) =>
      addDeskTab(current, crypto.randomUUID(), page),
    );
    go(page.href);
  };
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.key !== "Tab" ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      isEditableTarget(event.target) ||
      isOverlayTarget(event.target) ||
      desk.active === null
    )
      return;
    event.preventDefault();
    adjacent(desk.active, event.shiftKey ? -1 : 1);
  });
  // otomat-allow-effect: keyboard navigation follows the active project's manually opened tabs.
  useEffect(() => {
    const handle = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const activeId = desk.active;
  const index = desk.tabs.findIndex((tab) => tab.id === activeId);
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
            active={activeId === tab.id}
            onSelect={() => select(tab.id)}
            onAdjacent={(offset) => adjacent(tab.id, offset)}
            onMove={(offset) => move(tab.id, offset)}
            onClose={() => {
              if (activeId === tab.id && !confirmContextNavigation()) return;
              const next = closeDeskTab(desk, tab.id);
              projectDeskStore.actions.edit(projectKey, () => next);
              if (activeId === tab.id) go(next.page.href);
              focusTab(next.active);
            }}
            onDrop={(id) => {
              const from = desk.tabs.findIndex((entry) => entry.id === id);
              const to = desk.tabs.findIndex((entry) => entry.id === tab.id);
              if (from !== -1) move(id, to - from);
            }}
          />
        ))}
        {desk.tabs.length === 0 ? (
          <span className="truncate px-3 text-xs text-text-tertiary">{desk.page.label}</span>
        ) : null}
      </div>
      <NewTabMenu triggerRef={newTabRef} onPick={open} />
      <TabActionsMenu
        index={index}
        count={desk.tabs.length}
        onMove={(offset) => {
          if (activeId !== null) move(activeId, offset);
        }}
      />
    </nav>
  );
}
