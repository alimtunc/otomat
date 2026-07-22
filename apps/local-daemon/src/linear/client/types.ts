import type { LinearWorkspaceContract } from "@otomat/domain";

export interface LinearViewer {
  user_name: string;
  workspace_id: string;
  workspace_name: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  updated_at: string;
  state_type: string;
  state_name: string;
  state_color: string;
  priority: number;
  assignee_name: string | null;
  labels: { name: string; color: string }[];
}

export interface LinearIssueQuery {
  team_id: string;
  project_id: string;
  updated_since: string | null;
}

export interface LinearUserRef {
  id: string;
  name: string;
}

export interface LinearLabelRef {
  id: string;
  name: string;
  color: string;
}

export interface LinearStateRef {
  id: string;
  name: string;
  type: string;
  color: string;
}

export interface LinearIssueDetail {
  external_id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  updated_at: string;
  priority: number;
  assignee: LinearUserRef | null;
  labels: LinearLabelRef[];
  state: LinearStateRef;
}

export interface LinearIssueEditor {
  issue: LinearIssueDetail;
  team: {
    team_id: string;
    states: LinearStateRef[];
    members: LinearUserRef[];
    labels: LinearLabelRef[];
  };
}

export interface LinearIssueUpdate {
  title?: string;
  description?: string | null;
  priority?: number;
  assigneeId?: string | null;
  labelIds?: string[];
  stateId?: string;
}

export interface LinearCommentInput {
  id: string;
  issueId: string;
  body: string;
  parentId?: string;
}

export interface LinearComment {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string;
  parent_id: string | null;
}

export interface LinearAttachmentInput {
  issueId: string;
  url: string;
  title: string;
}

export interface LinearApiClient {
  viewer(apiKey: string, signal?: AbortSignal): Promise<LinearViewer>;
  workspace(apiKey: string, signal?: AbortSignal): Promise<LinearWorkspaceContract>;
  issues(apiKey: string, query: LinearIssueQuery, signal?: AbortSignal): Promise<LinearIssue[]>;
  issueEditor(apiKey: string, issueId: string, signal?: AbortSignal): Promise<LinearIssueEditor>;
  issueSnapshot(apiKey: string, issueId: string, signal?: AbortSignal): Promise<LinearIssueDetail>;
  updateIssue(
    apiKey: string,
    issueId: string,
    input: LinearIssueUpdate,
    signal?: AbortSignal,
  ): Promise<LinearIssueDetail>;
  listComments(apiKey: string, issueId: string, signal?: AbortSignal): Promise<LinearComment[]>;
  createComment(apiKey: string, input: LinearCommentInput, signal?: AbortSignal): Promise<string>;
  linkAttachment(
    apiKey: string,
    input: LinearAttachmentInput,
    signal?: AbortSignal,
  ): Promise<string>;
}
