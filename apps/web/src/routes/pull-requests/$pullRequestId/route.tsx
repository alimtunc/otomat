import { createFileRoute } from "@tanstack/react-router";
import { PullRequestReviewerLayout } from "@web/components/pull-requests/reviewer/layout";

export const Route = createFileRoute("/pull-requests/$pullRequestId")({
  component: PullRequestReviewerLayout,
});
