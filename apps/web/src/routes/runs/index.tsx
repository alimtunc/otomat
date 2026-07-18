import { createFileRoute } from "@tanstack/react-router";
import { RunsView } from "@web/components/runs/list/runs-view";

export const Route = createFileRoute("/runs/")({
  component: RunsView,
});
