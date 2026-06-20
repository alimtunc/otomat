import { createFileRoute } from "@tanstack/react-router";
import { AppearanceSection } from "@web/components/settings/appearance-section";

export const Route = createFileRoute("/settings/appearance")({
  component: AppearanceSection,
});
