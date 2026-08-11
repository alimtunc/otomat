import type { LinearWorkflowState, LinearWorkspaceContract } from "@otomat/domain";
import { z } from "zod";

import { linearError } from "../errors.js";
import {
  PROJECTS_QUERY,
  PROJECT_TEAMS_QUERY,
  projectTeamsResponseSchema,
  projectsResponseSchema,
  TEAM_STATES_QUERY,
  TEAMS_QUERY,
  teamStatesResponseSchema,
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
type TeamNode = z.infer<typeof teamsResponseSchema>["teams"]["nodes"][number];

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

/** A truncated workflow would silently hide the very state a lifecycle mapping needs, so it is paged out in full. */
async function completeTeamStates(
  executor: GraphQLExecutor,
  apiKey: string,
  team: TeamNode,
  signal?: AbortSignal,
): Promise<LinearWorkflowState[]> {
  const states = [...team.states.nodes];
  const seenCursors = new Set<string>();
  let { hasNextPage, endCursor } = team.states.pageInfo;

  for (let page = 1; hasNextPage && endCursor !== null && page < LINEAR_MAX_PAGES; page += 1) {
    if (seenCursors.has(endCursor)) throw linearError("linear_request_failed");
    seenCursors.add(endCursor);
    const response = await executor.execute(
      apiKey,
      TEAM_STATES_QUERY,
      { teamId: team.id, after: endCursor, first: LINEAR_PAGE_SIZE },
      teamStatesResponseSchema,
      signal,
    );
    states.push(...response.team.states.nodes);
    ({ hasNextPage, endCursor } = response.team.states.pageInfo);
  }
  if (hasNextPage) throw linearError("linear_request_failed");
  return states;
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
      const teamNodes = await executor.paginate(
        apiKey,
        TEAMS_QUERY,
        { stateFirst: LINEAR_NESTED_PAGE_SIZE },
        teamsResponseSchema,
        (response) => response.teams,
        signal,
      );
      const teams: LinearWorkspaceContract["teams"] = [];
      for (const team of teamNodes) {
        teams.push({
          id: team.id,
          key: team.key,
          name: team.name,
          states: await completeTeamStates(executor, apiKey, team, signal),
        });
      }
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
