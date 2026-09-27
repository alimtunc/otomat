import { createStore } from "@tanstack/react-store";
import {
  readStoredProjectTabs,
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
  recordRoute(key: string, route: string): void {
    setState((tabs) => persisted(tabs, withProjectTabRoute(tabs, key, route)));
  },
}));
