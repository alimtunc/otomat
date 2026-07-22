import { createFileRoute } from "@tanstack/react-router";
import { RunCompletionReportView } from "@web/components/runs/report/view";

export const Route = createFileRoute("/runs/$runId/report")({
  component: RunCompletionReportView,
});
