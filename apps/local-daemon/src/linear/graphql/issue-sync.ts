import { z } from "zod";

import { connection } from "./shared.js";

export const ISSUES_QUERY = `query OtomatIssues($after: String, $first: Int!, $filter: IssueFilter!) {
  issues(first: $first, after: $after, orderBy: updatedAt, filter: $filter) {
    nodes {
      id
      identifier
      title
      description
      url
      updatedAt
      priority
      assignee { name }
      labels { nodes { name color } }
      state { type name color }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

export const issuesResponseSchema = z.object({
  issues: connection(
    z.object({
      id: z.string().min(1),
      identifier: z.string().min(1),
      title: z.string().min(1),
      description: z.string().nullable(),
      url: z.url(),
      updatedAt: z.iso.datetime(),
      priority: z.number().int(),
      assignee: z.object({ name: z.string() }).nullable(),
      labels: z.object({
        nodes: z.array(z.object({ name: z.string(), color: z.string() })),
      }),
      state: z.object({ type: z.string(), name: z.string(), color: z.string() }),
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
