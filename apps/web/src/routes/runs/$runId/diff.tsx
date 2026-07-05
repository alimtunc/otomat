import { createFileRoute } from "@tanstack/react-router";
import { RunDiffView } from "@web/components/runs/diff/view";

export const Route = createFileRoute("/runs/$runId/diff")({
  component: RunDiffView,
});
