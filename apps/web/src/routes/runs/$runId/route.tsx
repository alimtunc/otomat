import { createFileRoute } from "@tanstack/react-router";
import { RunCockpitLayout } from "@web/components/runs/cockpit/layout";

export const Route = createFileRoute("/runs/$runId")({
  component: RunCockpitLayout,
});
