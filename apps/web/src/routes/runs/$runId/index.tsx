import { createFileRoute } from "@tanstack/react-router";
import { RunTimelineView } from "@web/components/runs/timeline/view";

export const Route = createFileRoute("/runs/$runId/")({
  component: RunTimelineView,
});
