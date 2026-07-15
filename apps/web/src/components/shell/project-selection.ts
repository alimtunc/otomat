import type { ProjectSummary } from "@otomat/ui";

const PROJECT_SELECTION_KEY = "otomat.selected-project-id";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSelectedProjectId(
  storage: Pick<Storage, "getItem"> | null = browserStorage(),
): string | undefined {
  if (storage === null) return undefined;
  try {
    return storage.getItem(PROJECT_SELECTION_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeSelectedProjectId(
  projectId: string,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): void {
  if (storage === null) return;
  try {
    storage.setItem(PROJECT_SELECTION_KEY, projectId);
  } catch {
    /* storage unavailable; the in-memory selection still applies */
  }
}

export function resolveSelectedProjectId(
  projects: ProjectSummary[],
  preferredId: string | undefined,
): string | undefined {
  if (preferredId !== undefined && projects.some((project) => project.id === preferredId)) {
    return preferredId;
  }
  return projects[0]?.id;
}
