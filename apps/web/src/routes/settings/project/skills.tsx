import { createFileRoute } from "@tanstack/react-router";
import { ProjectSkillsSection } from "@web/components/settings/project/skills-section";

export const Route = createFileRoute("/settings/project/skills")({
  component: ProjectSkillsSection,
});
