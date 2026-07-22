import { z } from "zod";

import { issueSnapshotResponseSchema } from "../graphql/issues.js";
import type { LinearIssueDetail } from "./types.js";

type IssueDetailNode = z.infer<typeof issueSnapshotResponseSchema>["issue"];

export function toIssueDetail(node: NonNullable<IssueDetailNode>): LinearIssueDetail {
  return {
    external_id: node.id,
    identifier: node.identifier,
    title: node.title,
    description: node.description,
    url: node.url,
    updated_at: node.updatedAt,
    priority: node.priority,
    assignee: node.assignee,
    labels: node.labels.nodes,
    state: node.state,
  };
}
