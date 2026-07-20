import { z } from "zod";

/** Well under any documented Linear page cap, and cheap in query-complexity points. */
export const LINEAR_PAGE_SIZE = 100;

/** Hard bound on one sync so an unexpected cursor loop can never page forever. */
export const LINEAR_MAX_PAGES = 200;

export const LINEAR_API_URL = "https://api.linear.app/graphql";

export const VIEWER_QUERY = `query OtomatViewer {
  viewer { name }
  organization { name urlKey }
}`;

export const TEAMS_QUERY = `query OtomatTeams($after: String, $first: Int!) {
  teams(first: $first, after: $after, orderBy: updatedAt) {
    nodes { id key name }
    pageInfo { hasNextPage endCursor }
  }
}`;

export const PROJECTS_QUERY = `query OtomatProjects($after: String, $first: Int!) {
  projects(first: $first, after: $after, orderBy: updatedAt) {
    nodes { id name teams(first: 25) { nodes { id } } }
    pageInfo { hasNextPage endCursor }
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
  organization: z.object({ name: z.string(), urlKey: z.string() }),
});

export const teamsResponseSchema = z.object({
  teams: connection(z.object({ id: z.string(), key: z.string(), name: z.string() })),
});

export const projectsResponseSchema = z.object({
  projects: connection(
    z.object({
      id: z.string(),
      name: z.string(),
      teams: z.object({ nodes: z.array(z.object({ id: z.string() })) }),
    }),
  ),
});

export const issuesResponseSchema = z.object({
  issues: connection(
    z.object({
      id: z.string(),
      identifier: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      url: z.string(),
      updatedAt: z.string(),
      // `WorkflowState.type` is a plain String upstream, so new values must not
      // break the mirror.
      state: z.object({ type: z.string() }),
    }),
  ),
});

export interface LinearIssueFilter {
  team: { id: { eq: string } };
  project?: { id: { eq: string } };
  updatedAt?: { gte: string };
}

/**
 * `gte`, not `gt`: Linear timestamps carry milliseconds and bulk edits share one,
 * so a strict comparison silently drops rows on the watermark boundary. Re-reading
 * the boundary is safe because every write upserts on the issue UUID.
 */
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
