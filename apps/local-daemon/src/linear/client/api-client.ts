import type { LinearTransport } from "../transport.js";
import { createAttachmentOperations } from "./attachments.js";
import { createCommentOperations } from "./comments.js";
import { createGraphQLExecutor } from "./executor.js";
import { createFileOperations } from "./files.js";
import { createIssueOperations } from "./issues.js";
import { readIssueRelations } from "./relations.js";
import type { LinearApiClient } from "./types.js";
import { createWorkspaceOperations } from "./workspace.js";

export function createLinearApiClient(transport: LinearTransport): LinearApiClient {
  const executor = createGraphQLExecutor(transport);
  return {
    issueRelations: (apiKey, issueId, signal) =>
      readIssueRelations(executor, apiKey, issueId, signal),
    ...createWorkspaceOperations(executor),
    ...createIssueOperations(executor),
    ...createCommentOperations(executor),
    ...createAttachmentOperations(executor),
    ...createFileOperations(),
  };
}
