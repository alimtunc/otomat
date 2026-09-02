import { EXECUTION_HOST_IDS, type ExecutionHostId, type ProjectContract } from "@otomat/domain";
import type { ProjectSummary } from "@otomat/ui";
import { asString } from "@web/lib/coerce";
import { readScoped, writeScoped, type ScopedStorage } from "@web/lib/storage";

const PROJECT_SELECTION_KEY = "otomat.selected-project-id";

export function selectableProjects(projects: ProjectContract[]): ProjectContract[] {
  return projects.filter((project) => project.has_repository);
}

/** One remembered project per host, so a host that regains the focus reopens its own project. */
export type SelectedProjectIds = Map<ExecutionHostId, string>;

export function readSelectedProjectIds(storage?: ScopedStorage | null): SelectedProjectIds {
  const ids: SelectedProjectIds = new Map();
  for (const hostId of EXECUTION_HOST_IDS) {
    const projectId = readScoped(PROJECT_SELECTION_KEY, hostId, asString, storage);
    if (projectId !== null) ids.set(hostId, projectId);
  }
  return ids;
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
