import { createFileRoute } from "@tanstack/react-router";
import { RunLogsView } from "@web/components/runs/logs/view";

export const Route = createFileRoute("/runs/$runId/logs")({
  component: RunLogsView,
});
