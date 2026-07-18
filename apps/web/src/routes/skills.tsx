import { createFileRoute } from "@tanstack/react-router";
import { SkillsView } from "@web/components/skills/skills-view";

export const Route = createFileRoute("/skills")({
  component: SkillsView,
});
