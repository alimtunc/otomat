import { createFileRoute } from "@tanstack/react-router";
import { parseIssuesListSearch } from "@web/components/issues/list/search";
import { IssuesView } from "@web/components/issues/list/view";

export const Route = createFileRoute("/issues/")({
  validateSearch: parseIssuesListSearch,
  component: IssuesView,
});
