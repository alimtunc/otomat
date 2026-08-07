const KEY_PREFIX = "otomat.panel";
const COLLAPSED = "true";
const EXPANDED = "false";

function storage(): Pick<Storage, "getItem" | "setItem"> | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function key(panelId: string): string {
  return `${KEY_PREFIX}.${panelId}.collapsed`;
}

/**
 * `null` while the panel has no stored choice — or one this module did not write —
 * so callers can keep their own default.
 */
export function readPanelCollapsed(panelId: string): boolean | null {
  const raw = storage()?.getItem(key(panelId));
  if (raw !== COLLAPSED && raw !== EXPANDED) return null;
  return raw === COLLAPSED;
}

export function writePanelCollapsed(panelId: string, collapsed: boolean): void {
  storage()?.setItem(key(panelId), collapsed ? COLLAPSED : EXPANDED);
}
