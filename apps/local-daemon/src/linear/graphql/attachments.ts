import { z } from "zod";

import { connection } from "./shared.js";

export const ISSUE_ATTACHMENTS_QUERY = `query OtomatIssueAttachments($id: String!, $first: Int!, $after: String) {
  issue(id: $id) {
    attachments(first: $first, after: $after) {
      nodes { id title url createdAt }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export const ATTACHMENT_LINK_MUTATION = `mutation OtomatAttachmentLink($issueId: String!, $url: String!, $title: String!) {
  attachmentLinkURL(issueId: $issueId, url: $url, title: $title) {
    success
    attachment { id }
  }
}`;

export const issueAttachmentsResponseSchema = z.object({
  issue: z
    .object({
      attachments: connection(
        z.object({
          id: z.string(),
          title: z.string(),
          url: z.string(),
          createdAt: z.iso.datetime(),
        }),
      ),
    })
    .nullable(),
});

export const attachmentLinkResponseSchema = z.object({
  attachmentLinkURL: z.object({
    success: z.boolean(),
    attachment: z.object({ id: z.string() }).nullable(),
  }),
});
