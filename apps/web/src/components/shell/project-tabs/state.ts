import { asRecord, asString } from "@web/lib/coerce";
import { isProjectScopedDetail } from "@web/lib/project-navigation";
import { readStoredJson, writeStored } from "@web/lib/storage";

const PROJECT_TABS_KEY = "otomat.project-tabs";

export interface StoredProjectTab {
  key: string;
  route: string | null;
}

function parseProjectTabs(raw: unknown): StoredProjectTab[] {
  if (!Array.isArray(raw)) return [];
  const tabs: StoredProjectTab[] = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    const key = asString(record?.["key"]);
    if (key === null || tabs.some((tab) => tab.key === key)) continue;
    tabs.push({ key, route: asString(record?.["route"]) });
  }
  return tabs;
}

export function readStoredProjectTabs(
  storage?: Pick<Storage, "getItem"> | null,
): StoredProjectTab[] {
  return readStoredJson(PROJECT_TABS_KEY, parseProjectTabs, storage);
}

export function writeStoredProjectTabs(
  tabs: StoredProjectTab[],
  storage?: Pick<Storage, "setItem"> | null,
): void {
  writeStored(PROJECT_TABS_KEY, JSON.stringify(tabs), storage);
}

/** Returns the same list when nothing changed, so the store can skip both a render and a write. */
export function withProjectTab(tabs: StoredProjectTab[], key: string): StoredProjectTab[] {
  return tabs.some((tab) => tab.key === key) ? tabs : [...tabs, { key, route: null }];
}

export function withoutProjectTab(tabs: StoredProjectTab[], key: string): StoredProjectTab[] {
  return tabs.some((tab) => tab.key === key) ? tabs.filter((tab) => tab.key !== key) : tabs;
}

export function withProjectTabRoute(
  tabs: StoredProjectTab[],
  key: string,
  route: string,
): StoredProjectTab[] {
  const current = tabs.find((tab) => tab.key === key);
  if (current === undefined || current.route === route) return tabs;
  return tabs.map((tab) => (tab.key === key ? { ...tab, route } : tab));
}

export function projectTabDestination(
  tabs: StoredProjectTab[],
  key: string,
  pathname: string,
): string | null {
  const stored = tabs.find((tab) => tab.key === key)?.route ?? null;
  if (stored !== null) return stored;
  return isProjectScopedDetail(pathname) ? "/issues" : null;
}
