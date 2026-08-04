import { createFileRoute } from "@tanstack/react-router";
import { ProjectSettingsSection } from "@web/components/settings/project/section";

export const Route = createFileRoute("/settings/project")({
  component: ProjectSettingsSection,
});
