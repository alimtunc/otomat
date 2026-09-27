import { createStore } from "@tanstack/react-store";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";

import {
  initialProjectDesk,
  readProjectDesks,
  writeProjectDesks,
  navigateDesk,
  type ProjectDesk,
  type DeskPage,
  type ProjectDesks,
} from "./state";

interface DeskState {
  desks: ProjectDesks;
  pending: { key: string; href: string } | null;
}
const initialState: DeskState = { desks: readProjectDesks(), pending: null };

export const projectDeskStore = createStore(initialState, ({ setState }) => ({
  edit(key: string, change: (desk: ProjectDesk) => ProjectDesk): void {
    setState((state) => {
      const previous =
        state.desks[key] ??
        initialProjectDesk(projectTabsStore.state.find((tab) => tab.key === key)?.route);
      const next = change(previous);
      if (next === state.desks[key]) return state;
      const desks = { ...state.desks, [key]: next };
      writeProjectDesks(desks);
      return { ...state, desks };
    });
  },
  expect(key: string, href: string): void {
    setState((state) => ({ ...state, pending: { key, href } }));
  },
  record(key: string, page: DeskPage): void {
    const pending = projectDeskStore.state.pending;
    if (pending !== null && (pending.key !== key || pending.href !== page.href)) return;
    projectDeskStore.actions.edit(key, (desk) => navigateDesk(desk, page));
    if (pending !== null) setState((state) => ({ ...state, pending: null }));
    projectTabsStore.actions.recordRoute(key, page.href);
  },
}));

export function getProjectDesk(key: string): ProjectDesk {
  return (
    projectDeskStore.state.desks[key] ??
    initialProjectDesk(projectTabsStore.state.find((tab) => tab.key === key)?.route)
  );
}
