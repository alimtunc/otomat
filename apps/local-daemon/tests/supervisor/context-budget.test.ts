import { contextSelectionSchema, type ContextReviewComment } from "@otomat/domain";
import { expect, it } from "vitest";

import { withContextBudget } from "#supervisor/context-budget";

function commentOnLargeFile(id: string): ContextReviewComment {
  return {
    id,
    file_path: "src/large.ts",
    line: 1,
    start_line: null,
    side: "new",
    body: "rename this",
    suggestion: null,
    suggestion_original: null,
    diff_sha: "abc123",
    hunk: "",
    current_file: "x".repeat(16_000),
  };
}

it("tells a fix step past the budget to resolve comments, since it attached no files", async () => {
  const freeze = withContextBudget(async (_references, note, reviewComments) =>
    contextSelectionSchema.parse({
      captured_at: "2026-09-23T00:00:00.000Z",
      issue: null,
      note,
      review_comments: reviewComments,
    }),
  );
  const comments = Array.from({ length: 40 }, (_, index) => commentOnLargeFile(`c${index}`));

  await expect(freeze([], null, comments)).rejects.toThrow(
    /one step can carry; fix or resolve some review comments first\.$/,
  );
});
