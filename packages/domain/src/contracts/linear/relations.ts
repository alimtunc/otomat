import { z } from "zod";

import { linearPrioritySchema, linearStateRefSchema, linearUserRefSchema } from "./editing.js";

const linearIssueNeighborSchema = z.object({
  external_id: z.string().min(1),
  identifier: z.string().min(1),
  title: z.string(),
  url: z.url({ protocol: /^https?$/ }),
  state: linearStateRefSchema,
  priority: linearPrioritySchema,
  assignee: linearUserRefSchema.nullable(),
  issue_id: z.string().nullable(),
});
export type LinearIssueNeighbor = z.infer<typeof linearIssueNeighborSchema>;

export const linearIssueRelationsSchema = z.object({
  parent: linearIssueNeighborSchema.nullable(),
  children: z.array(linearIssueNeighborSchema),
  relations: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["blocks", "blocked_by", "related"]),
      issue: linearIssueNeighborSchema,
    }),
  ),
  checked_at: z.iso.datetime(),
});
export type LinearIssueRelations = z.infer<typeof linearIssueRelationsSchema>;
