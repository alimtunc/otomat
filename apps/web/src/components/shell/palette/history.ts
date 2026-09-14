import { asRecord, asString } from "@web/lib/coerce";
import { isProjectScopedDetail } from "@web/lib/project-navigation";
import { readScoped, writeScoped } from "@web/lib/storage";

export interface PaletteVisit {
  href: string;
  label: string;
}

function parseVisits(value: unknown): PaletteVisit[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      const record = asRecord(entry);
      const href = asString(record?.href);
      const label = asString(record?.label);
      return href !== null && label !== null && isProjectScopedDetail(href)
        ? [{ href, label }]
        : [];
    })
    .slice(0, 6);
}

export function readPaletteVisits(scope: string): PaletteVisit[] {
  return readScoped("otomat.palette-visits", scope, parseVisits);
}

export function recordPaletteVisit(scope: string, visit: PaletteVisit): void {
  if (!isProjectScopedDetail(visit.href)) return;
  const previous = readPaletteVisits(scope);
  if (previous[0]?.href === visit.href && previous[0]?.label === visit.label) return;
  writeScoped(
    "otomat.palette-visits",
    scope,
    [visit, ...previous.filter((entry) => entry.href !== visit.href)].slice(0, 6),
  );
}
