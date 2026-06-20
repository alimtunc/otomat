import { createFileRoute } from "@tanstack/react-router";
import { IssuesView } from "@web/components/issues/issues-view";

export const Route = createFileRoute("/issues/")({
  component: IssuesView,
});
