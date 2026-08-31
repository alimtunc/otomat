import type { IssueSourceContract, ProjectContract } from "@otomat/domain";

/** The projects reading from one connection, in the order the daemon lists them. */
export function connectionProjects(
  connectionId: string,
  sources: IssueSourceContract[],
  projects: ProjectContract[],
): ProjectContract[] {
  const mapped = new Set(
    sources
      .filter((source) => source.connection_id === connectionId)
      .map((source) => source.project_id),
  );
  return projects.filter((project) => mapped.has(project.id));
}
