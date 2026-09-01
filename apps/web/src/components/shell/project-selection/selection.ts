import type { ExecutionHostId, ProjectContract } from "@otomat/domain";
import type { ProjectSummary } from "@otomat/ui";
import { asString } from "@web/lib/coerce";
import { readScoped, writeScoped, type ScopedStorage } from "@web/lib/storage";

const PROJECT_SELECTION_KEY = "otomat.selected-project-id";

export function selectableProjects(projects: ProjectContract[]): ProjectContract[] {
  return projects.filter((project) => project.has_repository);
}

export function readSelectedProjectId(
  hostId: ExecutionHostId,
  storage?: ScopedStorage | null,
): string | undefined {
  return readScoped(PROJECT_SELECTION_KEY, hostId, asString, storage) ?? undefined;
}

export function writeSelectedProjectId(
  hostId: ExecutionHostId,
  projectId: string,
  storage?: ScopedStorage | null,
): void {
  writeScoped(PROJECT_SELECTION_KEY, hostId, projectId, storage);
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
