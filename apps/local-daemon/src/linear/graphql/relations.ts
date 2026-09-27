import { z } from "zod";

import { connection, stateRefSchema, userRefSchema } from "./shared.js";

const NEIGHBOR_FIELDS =
  "id identifier title url priority assignee { id name } state { id name type color }";

export const neighborSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  url: z.url({ protocol: /^https?$/ }),
  state: stateRefSchema,
  priority: z.number().int().min(0).max(4),
  assignee: userRefSchema.nullable(),
});

export const PARENT_QUERY = `query OtomatIssueParent($id: String!) {
  issue(id: $id) { parent { ${NEIGHBOR_FIELDS} } }
}`;
export const parentResponseSchema = z.object({
  issue: z.object({ parent: neighborSchema.nullable() }).nullable(),
});

export const CHILDREN_QUERY = `query OtomatIssueChildren($id: String!, $first: Int!, $after: String) {
  issue(id: $id) {
    children(first: $first, after: $after) {
      nodes { ${NEIGHBOR_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;
export const childrenResponseSchema = z.object({
  issue: z.object({ children: connection(neighborSchema) }).nullable(),
});

const relationSchema = z.object({
  id: z.string(),
  type: z.string(),
  issue: neighborSchema,
  relatedIssue: neighborSchema,
});

export const RELATIONS_QUERY = `query OtomatIssueRelations($id: String!, $first: Int!, $after: String, $inverse: Boolean!) {
  issue(id: $id) {
    outgoing: relations(first: $first, after: $after) @skip(if: $inverse) {
      nodes { id type issue { ${NEIGHBOR_FIELDS} } relatedIssue { ${NEIGHBOR_FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
    incoming: inverseRelations(first: $first, after: $after) @include(if: $inverse) {
      nodes { id type issue { ${NEIGHBOR_FIELDS} } relatedIssue { ${NEIGHBOR_FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;
export const relationsResponseSchema = z.object({
  issue: z
    .object({
      outgoing: connection(relationSchema).optional(),
      incoming: connection(relationSchema).optional(),
    })
    .nullable(),
});
