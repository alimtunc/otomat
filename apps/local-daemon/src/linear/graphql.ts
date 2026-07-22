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
      priority
      assignee { name }
      labels { nodes { name color } }
      state { type name color }
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
      priority: z.number().int(),
      assignee: z.object({ name: z.string() }).nullable(),
      labels: z.object({
        nodes: z.array(z.object({ name: z.string(), color: z.string() })),
      }),
      state: z.object({ type: z.string(), name: z.string(), color: z.string() }),
    }),
  ),
});

const ISSUE_FIELDS = `id
    identifier
    title
    description
    url
    updatedAt
    priority
    assignee { id name }
    labels(first: $first) { nodes { id name color } }
    state { id name type color }`;

export const ISSUE_SNAPSHOT_QUERY = `query OtomatIssueSnapshot($id: String!, $first: Int!) {
  issue(id: $id) {
    ${ISSUE_FIELDS}
  }
}`;

export const ISSUE_EDITOR_QUERY = `query OtomatIssueEditor($id: String!, $first: Int!) {
  issue(id: $id) {
    ${ISSUE_FIELDS}
    team {
      id
      states(first: $first) { nodes { id name type color } }
      members(first: $first) { nodes { id name } }
      labels(first: $first) { nodes { id name color } }
    }
  }
}`;

export const ISSUE_UPDATE_MUTATION = `mutation OtomatIssueUpdate($id: String!, $first: Int!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
    issue {
      ${ISSUE_FIELDS}
    }
  }
}`;

export const ISSUE_COMMENTS_QUERY = `query OtomatIssueComments($id: String!, $first: Int!, $after: String) {
  issue(id: $id) {
    comments(first: $first, after: $after) {
      nodes { id body createdAt user { name } parent { id } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export const COMMENT_CREATE_MUTATION = `mutation OtomatCommentCreate($input: CommentCreateInput!) {
  commentCreate(input: $input) { success comment { id } }
}`;

export const ATTACHMENT_LINK_MUTATION = `mutation OtomatAttachmentLink($issueId: String!, $url: String!, $title: String!) {
  attachmentLinkURL(issueId: $issueId, url: $url, title: $title) {
    success
    attachment { id }
  }
}`;

const userRefSchema = z.object({ id: z.string(), name: z.string() });
const labelRefSchema = z.object({ id: z.string(), name: z.string(), color: z.string() });
const stateRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  color: z.string(),
});

const issueDetailNodeSchema = z.object({
  id: z.string().min(1),
  identifier: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  url: z.url(),
  updatedAt: z.iso.datetime(),
  priority: z.number().int().min(0).max(4),
  assignee: userRefSchema.nullable(),
  labels: z.object({ nodes: z.array(labelRefSchema) }),
  state: stateRefSchema,
});

export const issueSnapshotResponseSchema = z.object({ issue: issueDetailNodeSchema.nullable() });

export const issueEditorResponseSchema = z.object({
  issue: issueDetailNodeSchema
    .extend({
      team: z.object({
        id: z.string(),
        states: z.object({ nodes: z.array(stateRefSchema) }),
        members: z.object({ nodes: z.array(userRefSchema) }),
        labels: z.object({ nodes: z.array(labelRefSchema) }),
      }),
    })
    .nullable(),
});

export const issueUpdateResponseSchema = z.object({
  issueUpdate: z.object({ success: z.boolean(), issue: issueDetailNodeSchema.nullable() }),
});

export const issueCommentsResponseSchema = z.object({
  issue: z
    .object({
      comments: connection(
        z.object({
          id: z.string(),
          body: z.string(),
          createdAt: z.iso.datetime(),
          user: z.object({ name: z.string() }).nullable(),
          parent: z.object({ id: z.string() }).nullable(),
        }),
      ),
    })
    .nullable(),
});

export const commentCreateResponseSchema = z.object({
  commentCreate: z.object({
    success: z.boolean(),
    comment: z.object({ id: z.string() }).nullable(),
  }),
});

export const attachmentLinkResponseSchema = z.object({
  attachmentLinkURL: z.object({
    success: z.boolean(),
    attachment: z.object({ id: z.string() }).nullable(),
  }),
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
