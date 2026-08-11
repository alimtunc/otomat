import { z } from "zod";

import { connection } from "./shared.js";

export const VIEWER_QUERY = `query OtomatViewer {
  viewer { name }
  organization { id name }
}`;

export const TEAMS_QUERY = `query OtomatTeams($after: String, $first: Int!, $stateFirst: Int!) {
  teams(first: $first, after: $after, orderBy: updatedAt) {
    nodes {
      id
      key
      name
      states(first: $stateFirst) { nodes { id name } pageInfo { hasNextPage endCursor } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

export const TEAM_STATES_QUERY = `query OtomatTeamStates($teamId: String!, $after: String, $first: Int!) {
  team(id: $teamId) {
    states(first: $first, after: $after) {
      nodes { id name }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export const PROJECTS_QUERY = `query OtomatProjects($after: String, $first: Int!, $teamFirst: Int!) {
  projects(first: $first, after: $after, orderBy: updatedAt) {
    nodes { id name teams(first: $teamFirst) { nodes { id } pageInfo { hasNextPage endCursor } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

export const PROJECT_TEAMS_QUERY = `query OtomatProjectTeams($projectId: String!, $after: String, $first: Int!) {
  project(id: $projectId) {
    teams(first: $first, after: $after) {
      nodes { id }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export const viewerResponseSchema = z.object({
  viewer: z.object({ name: z.string() }),
  organization: z.object({ id: z.string().min(1), name: z.string() }),
});

const workflowStateNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const teamsResponseSchema = z.object({
  teams: connection(
    z.object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      states: connection(workflowStateNodeSchema),
    }),
  ),
});

export const teamStatesResponseSchema = z.object({
  team: z.object({ states: connection(workflowStateNodeSchema) }),
});

export const projectsResponseSchema = z.object({
  projects: connection(
    z.object({
      id: z.string(),
      name: z.string(),
      teams: connection(z.object({ id: z.string() })),
    }),
  ),
});

export const projectTeamsResponseSchema = z.object({
  project: z.object({ teams: connection(z.object({ id: z.string() })) }),
});
