import type { LinearWorkspaceContract } from "@otomat/domain";
import { z } from "zod";

import { linearError } from "../errors.js";
import {
  PROJECTS_QUERY,
  PROJECT_TEAMS_QUERY,
  projectTeamsResponseSchema,
  projectsResponseSchema,
  TEAMS_QUERY,
  teamsResponseSchema,
  VIEWER_QUERY,
  viewerResponseSchema,
} from "../graphql/workspace.js";
import {
  LINEAR_MAX_PAGES,
  LINEAR_NESTED_PAGE_SIZE,
  LINEAR_PAGE_SIZE,
  type GraphQLExecutor,
} from "./executor.js";
import type { LinearApiClient } from "./types.js";

type WorkspaceOperations = Pick<LinearApiClient, "viewer" | "workspace">;
type ProjectNode = z.infer<typeof projectsResponseSchema>["projects"]["nodes"][number];

async function completeProjectTeamIds(
  executor: GraphQLExecutor,
  apiKey: string,
  project: ProjectNode,
  signal?: AbortSignal,
): Promise<string[]> {
  const teamIds = project.teams.nodes.map((team) => team.id);
  const seenCursors = new Set<string>();
  let { hasNextPage, endCursor } = project.teams.pageInfo;

  for (let page = 1; hasNextPage && endCursor !== null && page < LINEAR_MAX_PAGES; page += 1) {
    if (seenCursors.has(endCursor)) throw linearError("linear_request_failed");
    seenCursors.add(endCursor);
    const response = await executor.execute(
      apiKey,
      PROJECT_TEAMS_QUERY,
      { projectId: project.id, after: endCursor, first: LINEAR_PAGE_SIZE },
      projectTeamsResponseSchema,
      signal,
    );
    teamIds.push(...response.project.teams.nodes.map((team) => team.id));
    ({ hasNextPage, endCursor } = response.project.teams.pageInfo);
  }
  if (hasNextPage) throw linearError("linear_request_failed");
  return teamIds;
}

export function createWorkspaceOperations(executor: GraphQLExecutor): WorkspaceOperations {
  return {
    async viewer(apiKey, signal) {
      const response = await executor.execute(
        apiKey,
        VIEWER_QUERY,
        {},
        viewerResponseSchema,
        signal,
      );
      return {
        user_name: response.viewer.name,
        workspace_id: response.organization.id,
        workspace_name: response.organization.name,
      };
    },
    async workspace(apiKey, signal) {
      const teams = await executor.paginate(
        apiKey,
        TEAMS_QUERY,
        {},
        teamsResponseSchema,
        (response) => response.teams,
        signal,
      );
      const projects = await executor.paginate(
        apiKey,
        PROJECTS_QUERY,
        { teamFirst: LINEAR_NESTED_PAGE_SIZE },
        projectsResponseSchema,
        (response) => response.projects,
        signal,
      );
      const completeProjects: LinearWorkspaceContract["projects"] = [];
      for (const project of projects) {
        completeProjects.push({
          id: project.id,
          name: project.name,
          team_ids: await completeProjectTeamIds(executor, apiKey, project, signal),
        });
      }
      return { teams, projects: completeProjects };
    },
  };
}
