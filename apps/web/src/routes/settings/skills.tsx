import { createFileRoute } from "@tanstack/react-router";
import { SkillsSection } from "@web/components/settings/skills/section";

export const Route = createFileRoute("/settings/skills")({
  component: SkillsSection,
});
