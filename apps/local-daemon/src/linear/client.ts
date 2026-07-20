import type { LinearWorkspaceContract } from "@otomat/domain";
import type { ZodType } from "zod";

import { LinearError, linearError } from "./errors.js";
import {
  buildIssueFilter,
  ISSUES_QUERY,
  issuesResponseSchema,
  LINEAR_MAX_PAGES,
  LINEAR_PAGE_SIZE,
  PROJECTS_QUERY,
  projectsResponseSchema,
  TEAMS_QUERY,
  teamsResponseSchema,
  VIEWER_QUERY,
  viewerResponseSchema,
} from "./graphql.js";
import type {
  LinearApiClient,
  LinearIssue,
  LinearIssueQuery,
  LinearTransport,
  LinearTransportResponse,
  LinearViewer,
} from "./types.js";

interface GraphQLErrorEntry {
  extensions?: { code?: unknown; type?: unknown };
}

interface GraphQLBody {
  data?: unknown;
  errors?: GraphQLErrorEntry[];
}

interface Page<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

function readBody(body: unknown): GraphQLBody {
  return typeof body === "object" && body !== null ? (body as GraphQLBody) : {};
}

function errorCodeOf(entry: GraphQLErrorEntry): string {
  const { code, type } = entry.extensions ?? {};
  if (typeof code === "string") return code.toLowerCase();
  if (typeof type === "string") return type.toLowerCase();
  return "";
}

/**
 * Linear answers a rate-limited query with HTTP 400 and an ordinary validation
 * failure with the same status, so the body's error code is the only reliable
 * signal. A 200 can also carry `errors` alongside partial `data`; a partial page
 * is rejected outright rather than mirrored.
 */
function assertNoGraphQLFailure(response: LinearTransportResponse): void {
  const body = readBody(response.body);
  const codes = (body.errors ?? []).map(errorCodeOf);

  if (codes.some((code) => code.includes("ratelimit"))) throw linearError("linear_rate_limited");
  if (codes.some((code) => code.includes("authentication")))
    throw linearError("linear_unauthorized");
  if (response.status === 401 || response.status === 403) throw linearError("linear_unauthorized");
  if (response.status >= 500) throw linearError("linear_unavailable");
  if (codes.length > 0 || response.status >= 400) throw linearError("linear_request_failed");
}

export function createLinearApiClient(transport: LinearTransport): LinearApiClient {
  async function execute<T>(
    apiKey: string,
    query: string,
    variables: Record<string, unknown>,
    schema: ZodType<T>,
  ): Promise<T> {
    let response: LinearTransportResponse;
    try {
      response = await transport({ query, variables, apiKey });
    } catch (error) {
      throw error instanceof LinearError ? error : linearError("linear_unavailable");
    }

    assertNoGraphQLFailure(response);

    const parsed = schema.safeParse(readBody(response.body).data);
    if (!parsed.success) throw linearError("linear_request_failed");
    return parsed.data;
  }

  async function paginate<TResponse, TNode>(
    apiKey: string,
    query: string,
    variables: Record<string, unknown>,
    schema: ZodType<TResponse>,
    select: (response: TResponse) => Page<TNode>,
  ): Promise<TNode[]> {
    const nodes: TNode[] = [];
    let after: string | null = null;

    for (let page = 0; page < LINEAR_MAX_PAGES; page += 1) {
      const response = await execute(
        apiKey,
        query,
        { ...variables, after, first: LINEAR_PAGE_SIZE },
        schema,
      );
      const { nodes: pageNodes, pageInfo } = select(response);
      nodes.push(...pageNodes);
      if (!pageInfo.hasNextPage || pageInfo.endCursor === null) return nodes;
      after = pageInfo.endCursor;
    }

    throw linearError("linear_request_failed");
  }

  return {
    async viewer(apiKey: string): Promise<LinearViewer> {
      const response = await execute(apiKey, VIEWER_QUERY, {}, viewerResponseSchema);
      return {
        user_name: response.viewer.name,
        workspace_name: response.organization.name,
        workspace_url_key: response.organization.urlKey,
      };
    },

    async workspace(apiKey: string): Promise<LinearWorkspaceContract> {
      const teams = await paginate(apiKey, TEAMS_QUERY, {}, teamsResponseSchema, (r) => r.teams);
      const projects = await paginate(
        apiKey,
        PROJECTS_QUERY,
        {},
        projectsResponseSchema,
        (r) => r.projects,
      );
      return {
        teams,
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          team_ids: project.teams.nodes.map((team) => team.id),
        })),
      };
    },

    async issues(apiKey: string, query: LinearIssueQuery): Promise<LinearIssue[]> {
      const filter = buildIssueFilter(query.team_id, query.project_id, query.updated_since);
      const nodes = await paginate(
        apiKey,
        ISSUES_QUERY,
        { filter },
        issuesResponseSchema,
        (r) => r.issues,
      );
      return nodes.map((issue) => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        url: issue.url,
        updated_at: issue.updatedAt,
        state_type: issue.state.type,
      }));
    },
  };
}
