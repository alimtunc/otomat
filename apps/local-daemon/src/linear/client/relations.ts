import type { LinearIssueNeighbor, LinearIssueRelations } from "@otomat/domain";
import type { z } from "zod";

import { linearError } from "../errors.js";
import {
  CHILDREN_QUERY,
  childrenResponseSchema,
  neighborSchema,
  PARENT_QUERY,
  parentResponseSchema,
  RELATIONS_QUERY,
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
  const relations = new Map<string, LinearIssueRelations["relations"][number]>();
  for (const inverse of [false, true]) {
    const nodes = await executor.paginate(
      apiKey,
      RELATIONS_QUERY,
      { id: issueId, inverse },
      relationsResponseSchema,
      (response) => {
        if (response.issue === null) throw linearError("linear_remote_issue_not_found");
        const page = inverse ? response.issue.incoming : response.issue.outgoing;
        if (page === undefined) throw linearError("linear_request_failed");
        return page;
      },
      signal,
    );
    for (const node of nodes) {
      if (node.type !== "blocks" && node.type !== "related") continue;
      const type = node.type === "blocks" && inverse ? "blocked_by" : node.type;
      relations.set(node.id, {
        id: node.id,
        type,
        issue: toNeighbor(inverse ? node.issue : node.relatedIssue),
      });
    }
  }
  return {
    parent: parent.issue.parent === null ? null : toNeighbor(parent.issue.parent),
    children: children.map(toNeighbor),
    relations: [...relations.values()],
    checked_at: new Date().toISOString(),
  };
}
