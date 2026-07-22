import { linearError } from "../errors.js";
import {
  COMMENT_CREATE_MUTATION,
  commentCreateResponseSchema,
  ISSUE_COMMENTS_QUERY,
  issueCommentsResponseSchema,
} from "../graphql/comments.js";
import type { GraphQLExecutor } from "./executor.js";
import type { LinearApiClient } from "./types.js";

type CommentOperations = Pick<LinearApiClient, "listComments" | "createComment">;

export function createCommentOperations(executor: GraphQLExecutor): CommentOperations {
  return {
    async listComments(apiKey, issueId, signal) {
      const nodes = await executor.paginate(
        apiKey,
        ISSUE_COMMENTS_QUERY,
        { id: issueId },
        issueCommentsResponseSchema,
        (response) => {
          if (response.issue === null) throw linearError("linear_remote_issue_not_found");
          return response.issue.comments;
        },
        signal,
      );
      return nodes.map((comment) => ({
        id: comment.id,
        body: comment.body,
        author_name: comment.user?.name ?? null,
        created_at: comment.createdAt,
        parent_id: comment.parent?.id ?? null,
      }));
    },
    async createComment(apiKey, input, signal) {
      const response = await executor.execute(
        apiKey,
        COMMENT_CREATE_MUTATION,
        { input },
        commentCreateResponseSchema,
        signal,
      );
      if (!response.commentCreate.success || response.commentCreate.comment === null) {
        throw linearError("linear_request_failed");
      }
      return response.commentCreate.comment.id;
    },
  };
}
