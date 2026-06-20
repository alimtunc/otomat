import { createFileRoute } from "@tanstack/react-router";
import { AboutSection } from "@web/components/settings/about-section";

export const Route = createFileRoute("/settings/about")({
  component: AboutSection,
});
