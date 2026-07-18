import { PlaceholderView } from "@web/components/shell/placeholder-view";

export function SkillsView() {
  return (
    <PlaceholderView
      active="skills"
      icon="book"
      label="Skills"
      titleNote="Instructions any agent in this workspace can use."
      title="No skills yet"
      description="Reusable instructions shared across agents land here once the daemon stores them."
      action={{ label: "New skill", disabledReason: "Skills are not wired up yet" }}
    />
  );
}
