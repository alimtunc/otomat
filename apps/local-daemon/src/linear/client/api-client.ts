import type { LinearTransport } from "../transport.js";
import { createAttachmentOperations } from "./attachments.js";
import { createCommentOperations } from "./comments.js";
import { createGraphQLExecutor } from "./executor.js";
import { createIssueOperations } from "./issues.js";
import type { LinearApiClient } from "./types.js";
import { createWorkspaceOperations } from "./workspace.js";

export function createLinearApiClient(transport: LinearTransport): LinearApiClient {
  const executor = createGraphQLExecutor(transport);
  return {
    ...createWorkspaceOperations(executor),
    ...createIssueOperations(executor),
    ...createCommentOperations(executor),
    ...createAttachmentOperations(executor),
  };
}
