import type { LinearWorkspaceContract } from "@otomat/domain";
import { z, type ZodType } from "zod";

import { linearError } from "./errors.js";
import {
  buildIssueFilter,
  ISSUES_QUERY,
  issuesResponseSchema,
  LINEAR_MAX_PAGES,
  LINEAR_NESTED_PAGE_SIZE,
  LINEAR_PAGE_SIZE,
  PROJECTS_QUERY,
  PROJECT_TEAMS_QUERY,
  projectTeamsResponseSchema,
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

const graphQLErrorEntrySchema = z.object({
  extensions: z
    .object({
      code: z.unknown().optional(),
      type: z.unknown().optional(),
    })
    .optional(),
});

const graphQLBodySchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(graphQLErrorEntrySchema).optional(),
});

type GraphQLErrorEntry = z.infer<typeof graphQLErrorEntrySchema>;

interface Page<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

function errorCodeOf(entry: GraphQLErrorEntry): string {
  const { code, type } = entry.extensions ?? {};
  if (typeof code === "string") return code.toLowerCase();
  if (typeof type === "string") return type.toLowerCase();
  return "";
}

function parseGraphQLResponse(
  response: LinearTransportResponse,
): z.infer<typeof graphQLBodySchema> {
  const parsed = graphQLBodySchema.safeParse(response.body);
  const body = parsed.success ? parsed.data : {};
  const codes = (body.errors ?? []).map(errorCodeOf);

  if (codes.some((code) => code.includes("ratelimit"))) throw linearError("linear_rate_limited");
  if (codes.some((code) => code.includes("authentication")))
    throw linearError("linear_unauthorized");
  if (response.status === 401 || response.status === 403) throw linearError("linear_unauthorized");
  if (response.status >= 500) throw linearError("linear_unavailable");
  if (codes.length > 0 || response.status >= 400) throw linearError("linear_request_failed");
  return body;
}

class DefaultLinearApiClient implements LinearApiClient {
  constructor(private readonly transport: LinearTransport) {}

  private async execute<T>(
    apiKey: string,
    query: string,
    variables: Record<string, unknown>,
    schema: ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();
    const response = await this.transport({ query, variables, apiKey, signal });
    signal?.throwIfAborted();
    const body = parseGraphQLResponse(response);
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) throw linearError("linear_request_failed");
    return parsed.data;
  }

  private async paginate<TResponse, TNode>(
    apiKey: string,
    query: string,
    variables: Record<string, unknown>,
    schema: ZodType<TResponse>,
    select: (response: TResponse) => Page<TNode>,
    signal?: AbortSignal,
  ): Promise<TNode[]> {
    const nodes: TNode[] = [];
    const seenCursors = new Set<string>();
    let after: string | null = null;

    for (let page = 0; page < LINEAR_MAX_PAGES; page += 1) {
      signal?.throwIfAborted();
      const response = await this.execute(
        apiKey,
        query,
        { ...variables, after, first: LINEAR_PAGE_SIZE },
        schema,
        signal,
      );
      const { nodes: pageNodes, pageInfo } = select(response);
      nodes.push(...pageNodes);
      if (!pageInfo.hasNextPage) return nodes;
      if (pageInfo.endCursor === null) throw linearError("linear_request_failed");
      if (seenCursors.has(pageInfo.endCursor)) throw linearError("linear_request_failed");
      seenCursors.add(pageInfo.endCursor);
      after = pageInfo.endCursor;
    }

    throw linearError("linear_request_failed");
  }

  async viewer(apiKey: string, signal?: AbortSignal): Promise<LinearViewer> {
    const response = await this.execute(apiKey, VIEWER_QUERY, {}, viewerResponseSchema, signal);
    return {
      user_name: response.viewer.name,
      workspace_id: response.organization.id,
      workspace_name: response.organization.name,
    };
  }

  async workspace(apiKey: string, signal?: AbortSignal): Promise<LinearWorkspaceContract> {
    const teams = await this.paginate(
      apiKey,
      TEAMS_QUERY,
      {},
      teamsResponseSchema,
      (response) => response.teams,
      signal,
    );
    const projects = await this.paginate(
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
        team_ids: await this.completeProjectTeamIds(apiKey, project, signal),
      });
    }
    return { teams, projects: completeProjects };
  }

  private async completeProjectTeamIds(
    apiKey: string,
    project: z.infer<typeof projectsResponseSchema>["projects"]["nodes"][number],
    signal?: AbortSignal,
  ): Promise<string[]> {
    const teamIds = project.teams.nodes.map((team) => team.id);
    const seenCursors = new Set<string>();
    let { hasNextPage, endCursor } = project.teams.pageInfo;

    for (let page = 1; hasNextPage && endCursor !== null && page < LINEAR_MAX_PAGES; page += 1) {
      if (seenCursors.has(endCursor)) throw linearError("linear_request_failed");
      seenCursors.add(endCursor);
      const response = await this.execute(
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

  async issues(
    apiKey: string,
    query: LinearIssueQuery,
    signal?: AbortSignal,
  ): Promise<LinearIssue[]> {
    const filter = buildIssueFilter(query.team_id, query.project_id, query.updated_since);
    const nodes = await this.paginate(
      apiKey,
      ISSUES_QUERY,
      { filter },
      issuesResponseSchema,
      (response) => response.issues,
      signal,
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
  }
}

export function createLinearApiClient(transport: LinearTransport): LinearApiClient {
  return new DefaultLinearApiClient(transport);
}
