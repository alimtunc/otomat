// @vitest-environment happy-dom
import { ReviewCommentCard } from "@web/components/runs/review/comment/card";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";
import { reviewComment } from "#support/review-comment";

describe("review comment card", () => {
  it("shows a suggestion as the exact replacement it proposes", async () => {
    const { container, cleanup } = await mount(
      <ReviewCommentCard
        comment={reviewComment({
          start_line: 2,
          line: 3,
          suggestion: "delta\nepsilon",
          suggestion_original: "beta\ngamma",
        })}
      />,
    );

    expect(container.textContent).toContain("beta\ngamma");
    expect(container.textContent).toContain("delta\nepsilon");
    expect(container.textContent).toContain("src/a.ts:2-3 · head");
    await cleanup();
  });

  it("offers an agent comment for the AI fix and a PR-review one never", async () => {
    const agent = await mount(
      <ReviewCommentCard comment={reviewComment()} onSelectedChange={() => {}} />,
    );
    expect(agent.container.querySelector('[role="checkbox"]')).not.toBeNull();
    expect(agent.container.textContent).toContain("Agent");
    await agent.cleanup();

    const onPr = await mount(
      <ReviewCommentCard
        comment={reviewComment({ destination: "pr_review" })}
        onSelectedChange={() => {}}
      />,
    );
    expect(onPr.container.querySelector('[role="checkbox"]')).toBeNull();
    expect(onPr.container.textContent).toContain("PR review");
    await onPr.cleanup();
  });

  it("states a failed publication with its reason and offers a retry", async () => {
    const onPublish = vi.fn();
    const { container, cleanup } = await mount(
      <ReviewCommentCard
        comment={reviewComment({
          destination: "pr_review",
          publication_status: "failed",
          publication_error: "GitHub refused the review comment. (HTTP 422)",
        })}
        onPublish={onPublish}
        publishing={false}
      />,
    );

    expect(container.textContent).toContain("Publish failed");
    expect(container.textContent).toContain("HTTP 422");
    await act(async () => {
      findButton("Retry publish")?.click();
    });
    expect(onPublish).toHaveBeenCalled();
    await cleanup();
  });

  it("links a published comment to GitHub and stops offering to publish it", async () => {
    const { container, cleanup } = await mount(
      <ReviewCommentCard
        comment={reviewComment({
          destination: "pr_review",
          publication_status: "published",
          external_url: "https://gh/pr/7#r1",
        })}
        onPublish={() => {}}
      />,
    );

    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://gh/pr/7#r1");
    expect(findButton("Retry publish")).toBeUndefined();
    expect(findButton("Publish to GitHub")).toBeUndefined();
    await cleanup();
  });

  it("shows no publication state at all on an agent comment", async () => {
    const { container, cleanup } = await mount(
      <ReviewCommentCard comment={reviewComment()} onPublish={() => {}} />,
    );

    expect(container.textContent).not.toContain("Publish to GitHub");
    await cleanup();
  });
});
