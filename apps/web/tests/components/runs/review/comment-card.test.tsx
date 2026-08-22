// @vitest-environment happy-dom
import { ReviewCommentCard } from "@web/components/runs/review/comment/card";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";
import { reviewComment } from "#support/review-comment";

const TARGET = { kind: "run", id: "run-1" } as const;

describe("review comment card", () => {
  it("shows a suggestion as the exact replacement it proposes", async () => {
    const { container, cleanup } = await mount(
      <ReviewCommentCard
        target={TARGET}
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

  it("names each comment's destination and offers no selection of its own", async () => {
    const agent = await mount(<ReviewCommentCard target={TARGET} comment={reviewComment()} />);
    expect(agent.container.textContent).toContain("Agent");
    expect(agent.container.querySelector('[role="checkbox"]')).toBeNull();
    await agent.cleanup();

    const onPr = await mount(
      <ReviewCommentCard target={TARGET} comment={reviewComment({ destination: "pr_review" })} />,
    );
    expect(onPr.container.textContent).toContain("PR review");
    expect(onPr.container.querySelector('[role="checkbox"]')).toBeNull();
    await onPr.cleanup();
  });

  it("states a failed publication with its reason and offers a retry", async () => {
    const onPublish = vi.fn();
    const { container, cleanup } = await mount(
      <ReviewCommentCard
        target={TARGET}
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
        target={TARGET}
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
      <ReviewCommentCard target={TARGET} comment={reviewComment()} onPublish={() => {}} />,
    );

    expect(container.textContent).not.toContain("Publish to GitHub");
    await cleanup();
  });
});
