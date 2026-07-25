import type { ProjectSummary } from "@otomat/ui";
import { readStored, writeStored } from "@web/lib/storage";

const PROJECT_SELECTION_KEY = "otomat.selected-project-id";

export function readSelectedProjectId(
  storage?: Pick<Storage, "getItem"> | null,
): string | undefined {
  return readStored(PROJECT_SELECTION_KEY, storage) ?? undefined;
}

export function writeSelectedProjectId(
  projectId: string,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  writeStored(PROJECT_SELECTION_KEY, projectId, storage);
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
