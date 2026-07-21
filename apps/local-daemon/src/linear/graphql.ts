import { z } from "zod";

export const LINEAR_PAGE_SIZE = 100;

export const LINEAR_NESTED_PAGE_SIZE = 25;

export const LINEAR_MAX_PAGES = 200;

export const LINEAR_API_URL = "https://api.linear.app/graphql";

export const VIEWER_QUERY = `query OtomatViewer {
  viewer { name }
  organization { id name }
}`;

export const TEAMS_QUERY = `query OtomatTeams($after: String, $first: Int!) {
  teams(first: $first, after: $after, orderBy: updatedAt) {
    nodes { id key name }
    pageInfo { hasNextPage endCursor }
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

export const ISSUES_QUERY = `query OtomatIssues($after: String, $first: Int!, $filter: IssueFilter!) {
  issues(first: $first, after: $after, orderBy: updatedAt, filter: $filter) {
    nodes {
      id
      identifier
      title
      description
      url
      updatedAt
      state { type }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});

function connection<T extends z.ZodType>(node: T) {
  return z.object({ nodes: z.array(node), pageInfo: pageInfoSchema });
}

export const viewerResponseSchema = z.object({
  viewer: z.object({ name: z.string() }),
  organization: z.object({ id: z.string().min(1), name: z.string() }),
});

export const teamsResponseSchema = z.object({
  teams: connection(z.object({ id: z.string(), key: z.string(), name: z.string() })),
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

export const issuesResponseSchema = z.object({
  issues: connection(
    z.object({
      id: z.string().min(1),
      identifier: z.string().min(1),
      title: z.string().min(1),
      description: z.string().nullable(),
      url: z.url(),
      updatedAt: z.iso.datetime(),
      state: z.object({ type: z.string() }),
    }),
  ),
});

interface LinearIssueFilter {
  team: { id: { eq: string } };
  project?: { id: { eq: string } };
  updatedAt?: { gte: string };
}

export function buildIssueFilter(
  teamId: string,
  projectId: string,
  updatedSince: string | null,
): LinearIssueFilter {
  return {
    team: { id: { eq: teamId } },
    ...(projectId === "" ? {} : { project: { id: { eq: projectId } } }),
    ...(updatedSince === null ? {} : { updatedAt: { gte: updatedSince } }),
  };
}
