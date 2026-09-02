import { createFileRoute } from "@tanstack/react-router";
import { PullRequestOverviewView } from "@web/components/pull-requests/overview/view";

export const Route = createFileRoute("/pull-requests/$pullRequestId/overview")({
  component: PullRequestOverviewView,
});
