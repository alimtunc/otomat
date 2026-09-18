import { linearError } from "../errors.js";
import {
  ATTACHMENT_LINK_MUTATION,
  attachmentLinkResponseSchema,
  ISSUE_ATTACHMENTS_QUERY,
  issueAttachmentsResponseSchema,
} from "../graphql/attachments.js";
import type { GraphQLExecutor } from "./executor.js";
import type { LinearApiClient } from "./types.js";

type AttachmentOperations = Pick<LinearApiClient, "listAttachments" | "linkAttachment">;

export function createAttachmentOperations(executor: GraphQLExecutor): AttachmentOperations {
  return {
    async listAttachments(apiKey, issueId, signal) {
      const nodes = await executor.paginate(
        apiKey,
        ISSUE_ATTACHMENTS_QUERY,
        { id: issueId },
        issueAttachmentsResponseSchema,
        (response) => {
          if (response.issue === null) throw linearError("linear_remote_issue_not_found");
          return response.issue.attachments;
        },
        signal,
      );
      return nodes.map((attachment) => ({
        id: attachment.id,
        title: attachment.title,
        url: attachment.url,
        created_at: attachment.createdAt,
      }));
    },
    async linkAttachment(apiKey, input, signal) {
      const response = await executor.execute(
        apiKey,
        ATTACHMENT_LINK_MUTATION,
        { issueId: input.issueId, url: input.url, title: input.title },
        attachmentLinkResponseSchema,
        signal,
      );
      if (!response.attachmentLinkURL.success || response.attachmentLinkURL.attachment === null) {
        throw linearError("linear_request_failed");
      }
      return response.attachmentLinkURL.attachment.id;
    },
  };
}
