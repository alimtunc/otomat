import { createFileRoute } from "@tanstack/react-router";
import { RepositoriesSection } from "@web/components/settings/repositories-section";

export const Route = createFileRoute("/settings/repositories")({
  component: RepositoriesSection,
});
