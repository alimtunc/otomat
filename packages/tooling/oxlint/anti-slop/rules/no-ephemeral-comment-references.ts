import { defineRule } from "@oxlint/plugins";

const ephemeralReferencePattern =
  /\bOTO-\d+\b|\b(?:issue|ticket|PR|pull request)\s*(?:#|-)?\s*\d+\b|\/(?:issues|pull)\/\d+\b/iu;

export const noEphemeralCommentReferencesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow ticket and pull request references in source comments.",
    },
    messages: {
      ephemeralReference:
        "Remove the ticket or pull request reference. Keep only a durable reason the code cannot express.",
    },
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (!ephemeralReferencePattern.test(comment.value)) continue;
          context.report({ node: comment, messageId: "ephemeralReference" });
        }
      },
    };
  },
});
