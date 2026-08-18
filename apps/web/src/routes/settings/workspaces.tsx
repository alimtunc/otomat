import { createFileRoute } from "@tanstack/react-router";
import { WorkspacesSection } from "@web/components/settings/workspaces/section";

export const Route = createFileRoute("/settings/workspaces")({
  component: WorkspacesSection,
});
