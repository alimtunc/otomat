import { createFileRoute } from "@tanstack/react-router";
import { RunPrView } from "@web/components/runs/pr/view";

export const Route = createFileRoute("/runs/$runId/pr")({
  component: RunPrView,
});
