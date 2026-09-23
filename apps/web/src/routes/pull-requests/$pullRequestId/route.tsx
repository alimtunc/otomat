import { createFileRoute } from "@tanstack/react-router";
import { prefetchPullRequest } from "@web/api/route-prefetch";
import { PullRequestReviewerLayout } from "@web/components/pull-requests/reviewer/layout";

export const Route = createFileRoute("/pull-requests/$pullRequestId")({
  loader: ({ params }) => prefetchPullRequest(params.pullRequestId),
  component: PullRequestReviewerLayout,
});
