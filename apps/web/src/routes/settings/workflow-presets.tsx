import { createFileRoute } from "@tanstack/react-router";
import { WorkflowPresetsSection } from "@web/components/settings/workflow-presets/section";

export const Route = createFileRoute("/settings/workflow-presets")({
  component: WorkflowPresetsSection,
});
