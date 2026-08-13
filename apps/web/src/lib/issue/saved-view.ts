import { asRecord, asString } from "@web/lib/coerce";
import { parseIssuesViewConfig, type IssuesViewConfig } from "@web/lib/issue/view-config";

export interface SavedView {
  id: string;
  name: string;
  config: IssuesViewConfig;
}

/** The system view is held apart from the saved ones: it can never be renamed, reordered or deleted, so a set always has a view to fall back to. */
export interface ViewSet {
  system: SavedView;
  saved: SavedView[];
  activeId: string;
}

export function emptyViewSet(system: SavedView): ViewSet {
  return { system, saved: [], activeId: system.id };
}

export function orderedViews(set: ViewSet): SavedView[] {
  return [set.system, ...set.saved];
}

export function findView(set: ViewSet, id: string | undefined): SavedView {
  return orderedViews(set).find((view) => view.id === id) ?? set.system;
}

export function selectView(set: ViewSet, id: string): ViewSet {
  return { ...set, activeId: findView(set, id).id };
}

export function addView(set: ViewSet, view: SavedView): ViewSet {
  return { ...set, saved: [...set.saved, view], activeId: view.id };
}

export function renameView(set: ViewSet, id: string, name: string): ViewSet {
  return { ...set, saved: set.saved.map((view) => (view.id === id ? { ...view, name } : view)) };
}

export function storeViewConfig(set: ViewSet, id: string, config: IssuesViewConfig): ViewSet {
  return { ...set, saved: set.saved.map((view) => (view.id === id ? { ...view, config } : view)) };
}

export function removeView(set: ViewSet, id: string): ViewSet {
  const saved = set.saved.filter((view) => view.id !== id);
  return { ...set, saved, activeId: set.activeId === id ? set.system.id : set.activeId };
}

export function moveView(set: ViewSet, id: string, offset: number): ViewSet {
  const from = set.saved.findIndex((view) => view.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= set.saved.length) return set;
  const saved = [...set.saved];
  saved.splice(to, 0, ...saved.splice(from, 1));
  return { ...set, saved };
}

function parseSavedView(value: unknown): SavedView | null {
  const entry = asRecord(value);
  if (entry === null) return null;
  const id = asString(entry.id);
  const name = asString(entry.name);
  if (id === null || name === null || name.trim() === "") return null;
  return { id, name, config: parseIssuesViewConfig(entry.config) };
}

/** Unknown ids, dropped views and corrupt entries all resolve to the system view rather than an empty screen. */
export function parseViewSet(value: unknown, system: SavedView): ViewSet {
  const entry = asRecord(value);
  if (entry === null) return emptyViewSet(system);
  const saved: SavedView[] = [];
  const ids = new Set([system.id]);
  for (const raw of Array.isArray(entry.saved) ? entry.saved : []) {
    const view = parseSavedView(raw);
    if (view !== null && !ids.has(view.id)) {
      ids.add(view.id);
      saved.push(view);
    }
  }
  const activeId = asString(entry.activeId);
  return {
    system,
    saved,
    activeId: activeId !== null && ids.has(activeId) ? activeId : system.id,
  };
}
