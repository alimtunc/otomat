import { createStore } from "@tanstack/react-store";
import {
  readStoredProjectTabs,
  withoutProjectTab,
  withProjectTab,
  withProjectTabRoute,
  writeStoredProjectTabs,
  type StoredProjectTab,
} from "@web/components/shell/project-tabs/state";

function persisted(previous: StoredProjectTab[], next: StoredProjectTab[]): StoredProjectTab[] {
  if (next !== previous) writeStoredProjectTabs(next);
  return next;
}

export const projectTabsStore = createStore(readStoredProjectTabs(), ({ setState }) => ({
  open(key: string): void {
    setState((tabs) => persisted(tabs, withProjectTab(tabs, key)));
  },
  close(key: string): void {
    setState((tabs) => persisted(tabs, withoutProjectTab(tabs, key)));
  },
  recordRoute(key: string, route: string): void {
    setState((tabs) => persisted(tabs, withProjectTabRoute(tabs, key, route)));
  },
}));
