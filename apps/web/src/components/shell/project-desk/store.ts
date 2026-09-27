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

function seededDesk(desks: ProjectDesks, key: string): ProjectDesk {
  return (
    desks[key] ?? initialProjectDesk(projectTabsStore.state.find((tab) => tab.key === key)?.route)
  );
}

export const projectDeskStore = createStore(initialState, ({ setState, get }) => {
  const edit = (key: string, change: (desk: ProjectDesk) => ProjectDesk): void => {
    setState((state) => {
      const next = change(seededDesk(state.desks, key));
      if (next === state.desks[key]) return state;
      const desks = { ...state.desks, [key]: next };
      writeProjectDesks(desks);
      return { ...state, desks };
    });
  };
  return {
    edit,
    expect(key: string, href: string): void {
      setState((state) => ({ ...state, pending: { key, href } }));
    },
    record(key: string, page: DeskPage): boolean {
      const pending = get().pending;
      if (pending !== null && (pending.key !== key || pending.href !== page.href)) return false;
      edit(key, (desk) => navigateDesk(desk, page));
      if (pending !== null) setState((state) => ({ ...state, pending: null }));
      projectTabsStore.actions.recordRoute(key, page.href);
      return true;
    },
  };
});

export function getProjectDesk(key: string): ProjectDesk {
  return seededDesk(projectDeskStore.state.desks, key);
}
