import { z } from "zod";

export const ATTACHMENT_LINK_MUTATION = `mutation OtomatAttachmentLink($issueId: String!, $url: String!, $title: String!) {
  attachmentLinkURL(issueId: $issueId, url: $url, title: $title) {
    success
    attachment { id }
  }
}`;

export const attachmentLinkResponseSchema = z.object({
  attachmentLinkURL: z.object({
    success: z.boolean(),
    attachment: z.object({ id: z.string() }).nullable(),
  }),
});
