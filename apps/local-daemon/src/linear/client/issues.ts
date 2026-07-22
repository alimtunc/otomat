import { linearError } from "../errors.js";
import { buildIssueFilter, ISSUES_QUERY, issuesResponseSchema } from "../graphql/issue-sync.js";
import {
  ISSUE_EDITOR_QUERY,
  ISSUE_SNAPSHOT_QUERY,
  ISSUE_UPDATE_MUTATION,
  issueEditorResponseSchema,
  issueSnapshotResponseSchema,
  issueUpdateResponseSchema,
} from "../graphql/issues.js";
import { LINEAR_PAGE_SIZE, type GraphQLExecutor } from "./executor.js";
import { toIssueDetail } from "./mappers.js";
import type { LinearApiClient } from "./types.js";

type IssueOperations = Pick<
  LinearApiClient,
  "issues" | "issueSnapshot" | "issueEditor" | "updateIssue"
>;

export function createIssueOperations(executor: GraphQLExecutor): IssueOperations {
  return {
    async issues(apiKey, query, signal) {
      const filter = buildIssueFilter(query.team_id, query.project_id, query.updated_since);
      const nodes = await executor.paginate(
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
        state_name: issue.state.name,
        state_color: issue.state.color,
        priority: issue.priority,
        assignee_name: issue.assignee?.name ?? null,
        labels: issue.labels.nodes,
      }));
    },
    async issueSnapshot(apiKey, issueId, signal) {
      const response = await executor.execute(
        apiKey,
        ISSUE_SNAPSHOT_QUERY,
        { id: issueId, first: LINEAR_PAGE_SIZE },
        issueSnapshotResponseSchema,
        signal,
      );
      if (response.issue === null) throw linearError("linear_remote_issue_not_found");
      return toIssueDetail(response.issue);
    },
    async issueEditor(apiKey, issueId, signal) {
      const response = await executor.execute(
        apiKey,
        ISSUE_EDITOR_QUERY,
        { id: issueId, first: LINEAR_PAGE_SIZE },
        issueEditorResponseSchema,
        signal,
      );
      if (response.issue === null) throw linearError("linear_remote_issue_not_found");
      const { team } = response.issue;
      return {
        issue: toIssueDetail(response.issue),
        team: {
          team_id: team.id,
          states: team.states.nodes,
          members: team.members.nodes,
          labels: team.labels.nodes,
        },
      };
    },
    async updateIssue(apiKey, issueId, input, signal) {
      const response = await executor.execute(
        apiKey,
        ISSUE_UPDATE_MUTATION,
        { id: issueId, first: LINEAR_PAGE_SIZE, input },
        issueUpdateResponseSchema,
        signal,
      );
      if (!response.issueUpdate.success || response.issueUpdate.issue === null) {
        throw linearError("linear_request_failed");
      }
      return toIssueDetail(response.issueUpdate.issue);
    },
  };
}
