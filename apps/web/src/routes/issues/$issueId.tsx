import { createFileRoute } from "@tanstack/react-router";
import { IssueDetailView } from "@web/components/issues/issue-detail-view";

export const Route = createFileRoute("/issues/$issueId")({
  component: IssueDetailView,
});
