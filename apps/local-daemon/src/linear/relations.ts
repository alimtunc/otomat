import { getIssue, getIssueBySourceExternalId, type Db } from "@otomat/db";
import type { LinearIssueNeighbor, LinearIssueRelations } from "@otomat/domain";

import type { LinearApiClient } from "./client/types.js";
import type { LinearAuthorization } from "./connections.js";
import { linearError } from "./errors.js";
import { projectConnectionId } from "./sources.js";

export async function readLinearRelations(
  db: Db,
  client: LinearApiClient,
  issueId: string,
  authorization: LinearAuthorization,
): Promise<LinearIssueRelations> {
  const issue = getIssue(db, issueId);
  if (!issue) throw linearError("linear_issue_not_found");
  if (issue.source !== "linear" || issue.source_external_id === null) {
    throw linearError("linear_issue_not_writable");
  }
  const connection = projectConnectionId(db, issue.project_id);
  const externalId = issue.source_external_id;
  const result = await authorization.run(() =>
    client.issueRelations(authorization.apiKey, externalId, authorization.signal),
  );
  authorization.signal.throwIfAborted();
  const resolve = (neighbor: LinearIssueNeighbor): LinearIssueNeighbor => {
    const local = getIssueBySourceExternalId(db, "linear", neighbor.external_id);
    const sameConnection =
      local !== undefined && projectConnectionId(db, local.project_id) === connection;
    return { ...neighbor, issue_id: sameConnection ? local.id : null };
  };
  return {
    ...result,
    parent: result.parent === null ? null : resolve(result.parent),
    children: result.children.map(resolve),
    relations: result.relations.map((relation) => ({
      ...relation,
      issue: resolve(relation.issue),
    })),
  };
}
