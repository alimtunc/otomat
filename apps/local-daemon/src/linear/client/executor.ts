import { z, type ZodType } from "zod";

import { linearError } from "../errors.js";
import type { LinearTransport, LinearTransportResponse } from "../transport.js";

export const LINEAR_PAGE_SIZE = 100;
export const LINEAR_NESTED_PAGE_SIZE = 25;
export const LINEAR_MAX_PAGES = 200;

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

export interface Page<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

export interface GraphQLExecutor {
  execute<T>(
    apiKey: string,
    query: string,
    variables: Record<string, unknown>,
    schema: ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T>;
  paginate<TResponse, TNode>(
    apiKey: string,
    query: string,
    variables: Record<string, unknown>,
    schema: ZodType<TResponse>,
    select: (response: TResponse) => Page<TNode>,
    signal?: AbortSignal,
  ): Promise<TNode[]>;
}

function errorCodeOf(entry: GraphQLErrorEntry): string {
  const { code, type } = entry.extensions ?? {};
  if (typeof code === "string") return code.toLowerCase();
  if (typeof type === "string") return type.toLowerCase();
  return "";
}

function parseResponse(response: LinearTransportResponse): z.infer<typeof graphQLBodySchema> {
  const parsed = graphQLBodySchema.safeParse(response.body);
  const body = parsed.success ? parsed.data : {};
  const codes = (body.errors ?? []).map(errorCodeOf);

  if (codes.some((code) => code.includes("ratelimit"))) throw linearError("linear_rate_limited");
  if (codes.some((code) => code.includes("authentication"))) {
    throw linearError("linear_unauthorized");
  }
  if (response.status === 401 || response.status === 403) throw linearError("linear_unauthorized");
  if (response.status >= 500) throw linearError("linear_unavailable");
  if (codes.length > 0 || response.status >= 400) throw linearError("linear_request_failed");
  return body;
}

export function createGraphQLExecutor(transport: LinearTransport): GraphQLExecutor {
  async function execute<T>(
    apiKey: string,
    query: string,
    variables: Record<string, unknown>,
    schema: ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();
    const response = await transport({ query, variables, apiKey, signal });
    signal?.throwIfAborted();
    const parsed = schema.safeParse(parseResponse(response).data);
    if (!parsed.success) throw linearError("linear_request_failed");
    return parsed.data;
  }

  async function paginate<TResponse, TNode>(
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
      const response = await execute(
        apiKey,
        query,
        { ...variables, after, first: LINEAR_PAGE_SIZE },
        schema,
        signal,
      );
      const { nodes: pageNodes, pageInfo } = select(response);
      nodes.push(...pageNodes);
      if (!pageInfo.hasNextPage) return nodes;
      if (pageInfo.endCursor === null || seenCursors.has(pageInfo.endCursor)) {
        throw linearError("linear_request_failed");
      }
      seenCursors.add(pageInfo.endCursor);
      after = pageInfo.endCursor;
    }

    throw linearError("linear_request_failed");
  }

  return { execute, paginate };
}
