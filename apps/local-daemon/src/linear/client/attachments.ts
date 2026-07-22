import { linearError } from "../errors.js";
import { ATTACHMENT_LINK_MUTATION, attachmentLinkResponseSchema } from "../graphql/attachments.js";
import type { GraphQLExecutor } from "./executor.js";
import type { LinearApiClient } from "./types.js";

type AttachmentOperations = Pick<LinearApiClient, "linkAttachment">;

export function createAttachmentOperations(executor: GraphQLExecutor): AttachmentOperations {
  return {
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
