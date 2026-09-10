import { describe, expect, it } from "vitest";

import { reviewSubmissionRefusal } from "#domain/contracts/review";

describe("reviewSubmissionRefusal", () => {
  it("approves with nothing attached, with a summary, or with comments", () => {
    expect(reviewSubmissionRefusal("approve", { body: "", comments: 0 })).toBeNull();
    expect(reviewSubmissionRefusal("approve", { body: "   ", comments: 0 })).toBeNull();
    expect(reviewSubmissionRefusal("approve", { body: "lgtm", comments: 2 })).toBeNull();
  });

  it("requires a summary to request changes, whatever the comments say", () => {
    expect(
      reviewSubmissionRefusal("request_changes", { body: "rename these", comments: 0 }),
    ).toBeNull();
    expect(reviewSubmissionRefusal("request_changes", { body: "", comments: 3 })).toBe(
      "GitHub needs a summary to request changes.",
    );
  });

  it("takes a comment carrying a summary or an inline comment, and refuses an empty one", () => {
    expect(reviewSubmissionRefusal("comment", { body: "two notes below", comments: 0 })).toBeNull();
    expect(reviewSubmissionRefusal("comment", { body: "", comments: 1 })).toBeNull();
    expect(reviewSubmissionRefusal("comment", { body: "  ", comments: 0 })).toBe(
      "Write a summary or leave a comment on the diff before submitting.",
    );
  });

  it("reads whitespace as an empty summary", () => {
    expect(reviewSubmissionRefusal("request_changes", { body: " \n\t ", comments: 0 })).toBe(
      "GitHub needs a summary to request changes.",
    );
  });
});
