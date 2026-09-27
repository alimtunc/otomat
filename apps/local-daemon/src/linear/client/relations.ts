import type {
  LinearIssueNeighbor,
  LinearIssueRelation,
  LinearIssueRelations,
} from "@otomat/domain";
import type { z } from "zod";

import { linearError } from "../errors.js";
import {
  CHILDREN_QUERY,
  childrenResponseSchema,
  INCOMING_RELATIONS_QUERY,
  neighborSchema,
  OUTGOING_RELATIONS_QUERY,
  PARENT_QUERY,
  parentResponseSchema,
  relationsResponseSchema,
} from "../graphql/relations.js";
import type { GraphQLExecutor } from "./executor.js";

function toNeighbor(node: z.infer<typeof neighborSchema>): LinearIssueNeighbor {
  return {
    external_id: node.id,
    identifier: node.identifier,
    title: node.title,
    url: node.url,
    state: node.state,
    priority: node.priority,
    assignee: node.assignee,
    issue_id: null,
  };
}

async function readRelationEdges(
  executor: GraphQLExecutor,
  apiKey: string,
  issueId: string,
  inverse: boolean,
  signal?: AbortSignal,
): Promise<LinearIssueRelation[]> {
  const nodes = await executor.paginate(
    apiKey,
    inverse ? INCOMING_RELATIONS_QUERY : OUTGOING_RELATIONS_QUERY,
    { id: issueId },
    relationsResponseSchema,
    (response) => {
      if (response.issue === null) throw linearError("linear_remote_issue_not_found");
      return response.issue.page;
    },
    signal,
  );
  const edges: LinearIssueRelation[] = [];
  for (const node of nodes) {
    if (node.type !== "blocks" && node.type !== "related") continue;
    edges.push({
      id: node.id,
      type: node.type === "blocks" && inverse ? "blocked_by" : node.type,
      issue: toNeighbor(inverse ? node.issue : node.relatedIssue),
    });
  }
  return edges;
}

export async function readIssueRelations(
  executor: GraphQLExecutor,
  apiKey: string,
  issueId: string,
  signal?: AbortSignal,
): Promise<LinearIssueRelations> {
  const parent = await executor.execute(
    apiKey,
    PARENT_QUERY,
    { id: issueId },
    parentResponseSchema,
    signal,
  );
  if (parent.issue === null) throw linearError("linear_remote_issue_not_found");
  const children = await executor.paginate(
    apiKey,
    CHILDREN_QUERY,
    { id: issueId },
    childrenResponseSchema,
    (response) => {
      if (response.issue === null) throw linearError("linear_remote_issue_not_found");
      return response.issue.children;
    },
    signal,
  );
  const relations = new Map<string, LinearIssueRelation>();
  for (const inverse of [false, true]) {
    for (const edge of await readRelationEdges(executor, apiKey, issueId, inverse, signal)) {
      relations.set(edge.id, edge);
    }
  }
  return {
    parent: parent.issue.parent === null ? null : toNeighbor(parent.issue.parent),
    children: children.map(toNeighbor),
    relations: [...relations.values()],
    checked_at: new Date().toISOString(),
  };
}
