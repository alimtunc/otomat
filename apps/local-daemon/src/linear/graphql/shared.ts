import { z } from "zod";

export const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});

export function connection<T extends z.ZodType>(node: T) {
  return z.object({ nodes: z.array(node), pageInfo: pageInfoSchema });
}

export const userRefSchema = z.object({ id: z.string(), name: z.string() });

export const labelRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

export const stateRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  color: z.string(),
});

export const ISSUE_FIELDS = `id
    identifier
    title
    description
    url
    updatedAt
    priority
    assignee { id name }
    labels(first: $first) { nodes { id name color } }
    state { id name type color }`;

export const issueDetailNodeSchema = z.object({
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
