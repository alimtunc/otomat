import { z } from "zod";

import {
  ISSUE_FIELDS,
  issueDetailNodeSchema,
  labelRefSchema,
  stateRefSchema,
  userRefSchema,
} from "./shared.js";

export const ISSUE_SNAPSHOT_QUERY = `query OtomatIssueSnapshot($id: String!, $first: Int!) {
  issue(id: $id) {
    ${ISSUE_FIELDS}
  }
}`;

export const ISSUE_EDITOR_QUERY = `query OtomatIssueEditor($id: String!, $first: Int!) {
  issue(id: $id) {
    ${ISSUE_FIELDS}
    team {
      id
      states(first: $first) { nodes { id name type color } }
      members(first: $first) { nodes { id name } }
      labels(first: $first) { nodes { id name color } }
    }
  }
}`;

export const ISSUE_UPDATE_MUTATION = `mutation OtomatIssueUpdate($id: String!, $first: Int!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
    issue {
      ${ISSUE_FIELDS}
    }
  }
}`;

export const issueSnapshotResponseSchema = z.object({ issue: issueDetailNodeSchema.nullable() });

export const issueEditorResponseSchema = z.object({
  issue: issueDetailNodeSchema
    .extend({
      team: z.object({
        id: z.string(),
        states: z.object({ nodes: z.array(stateRefSchema) }),
        members: z.object({ nodes: z.array(userRefSchema) }),
        labels: z.object({ nodes: z.array(labelRefSchema) }),
      }),
    })
    .nullable(),
});

export const issueUpdateResponseSchema = z.object({
  issueUpdate: z.object({ success: z.boolean(), issue: issueDetailNodeSchema.nullable() }),
});
