import { withItemMoved } from "@web/lib/array";
import { asRecord, asString } from "@web/lib/coerce";
import { isProjectRoute } from "@web/lib/project-navigation";
import { readStoredJson, writeStored } from "@web/lib/storage";

const STORAGE_KEY = "otomat.project-desks";
export interface DeskPage {
  href: string;
  label: string;
}
export interface DeskTab extends DeskPage {
  id: string;
}
export interface ProjectDesk {
  tabs: DeskTab[];
  active: string | null;
  page: DeskPage;
}
export type ProjectDesks = Record<string, ProjectDesk>;
export const PROJECT_HOME: DeskPage = { href: "/project", label: "Project" };

export function isDeskRoute(href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  if (!URL.canParse(href, "http://otomat.local")) return false;
  const url = new URL(href, "http://otomat.local");
  if (url.origin !== "http://otomat.local") return false;
  return (
    isProjectRoute(url.pathname) ||
    (url.pathname === "/conversations" &&
      Boolean(url.searchParams.get("run") || url.searchParams.get("terminal")))
  );
}

function readPage(raw: unknown): DeskPage | null {
  const record = asRecord(raw);
  const href = asString(record?.["href"]);
  const label = asString(record?.["label"]);
  return href !== null && label !== null && isDeskRoute(href) ? { href, label } : null;
}

export function readProjectDesks(storage?: Pick<Storage, "getItem"> | null): ProjectDesks {
  return readStoredJson(
    STORAGE_KEY,
    (raw) => {
      const result: ProjectDesks = {};
      for (const [key, value] of Object.entries(asRecord(raw) ?? {})) {
        if (!/^(local|remote):.+/.test(key)) continue;
        const record = asRecord(value);
        const page = readPage(record?.["page"]);
        const source = record?.["tabs"];
        if (page === null || !Array.isArray(source)) continue;
        const tabs: DeskTab[] = [];
        for (const candidate of source) {
          const tab = readPage(candidate);
          const id = asString(asRecord(candidate)?.["id"]);
          if (tab !== null && id && !tabs.some((entry) => entry.id === id))
            tabs.push({ ...tab, id });
        }
        const active = asString(record?.["active"]);
        result[key] = {
          tabs,
          active: tabs.some((tab) => tab.id === active) ? active : (tabs[0]?.id ?? null),
          page,
        };
      }
      return result;
    },
    storage,
  );
}

export function writeProjectDesks(desks: ProjectDesks): void {
  writeStored(STORAGE_KEY, JSON.stringify(desks));
}

export function initialProjectDesk(href: string | null = null): ProjectDesk {
  const page = href !== null && isDeskRoute(href) ? { href, label: "Workspace" } : PROJECT_HOME;
  return { tabs: [{ id: "initial", ...page }], active: "initial", page };
}

export function currentDeskPage(desk: ProjectDesk): DeskPage {
  return desk.tabs.find((tab) => tab.id === desk.active) ?? desk.page;
}

export function navigateDesk(desk: ProjectDesk, page: DeskPage): ProjectDesk {
  const current = currentDeskPage(desk);
  if (!isDeskRoute(page.href) || (current.href === page.href && current.label === page.label))
    return desk;
  return {
    ...desk,
    page,
    tabs: desk.tabs.map((tab) => (tab.id === desk.active ? { ...tab, ...page } : tab)),
  };
}

export function addDeskTab(desk: ProjectDesk, id: string, page: DeskPage): ProjectDesk {
  if (!isDeskRoute(page.href) || desk.tabs.some((tab) => tab.id === id)) return desk;
  return { tabs: [...desk.tabs, { id, ...page }], active: id, page };
}

export function closeDeskTab(desk: ProjectDesk, id: string): ProjectDesk {
  const index = desk.tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return desk;
  const tabs = desk.tabs.filter((tab) => tab.id !== id);
  return {
    tabs,
    active: desk.active === id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null) : desk.active,
    page: tabs.length === 0 ? PROJECT_HOME : desk.page,
  };
}

export function moveDeskTab(desk: ProjectDesk, id: string, offset: number): ProjectDesk {
  const tabs = withItemMoved(
    desk.tabs,
    desk.tabs.findIndex((tab) => tab.id === id),
    offset,
  );
  return tabs === null ? desk : { ...desk, tabs };
}
