import { z } from "zod";

import { connection } from "./shared.js";

export const ISSUE_COMMENTS_QUERY = `query OtomatIssueComments($id: String!, $first: Int!, $after: String) {
  issue(id: $id) {
    comments(first: $first, after: $after) {
      nodes { id body createdAt user { name } parent { id } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export const COMMENT_CREATE_MUTATION = `mutation OtomatCommentCreate($input: CommentCreateInput!) {
  commentCreate(input: $input) { success comment { id } }
}`;

export const issueCommentsResponseSchema = z.object({
  issue: z
    .object({
      comments: connection(
        z.object({
          id: z.string(),
          body: z.string(),
          createdAt: z.iso.datetime(),
          user: z.object({ name: z.string() }).nullable(),
          parent: z.object({ id: z.string() }).nullable(),
        }),
      ),
    })
    .nullable(),
});

export const commentCreateResponseSchema = z.object({
  commentCreate: z.object({
    success: z.boolean(),
    comment: z.object({ id: z.string() }).nullable(),
  }),
});
