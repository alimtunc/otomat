import { EmptyState, type IconName } from "@otomat/ui";

export function NoProjectSelectedState({ icon }: { icon: IconName }) {
  return (
    <EmptyState
      icon={icon}
      variant="inline"
      title="No project selected"
      description="Register a repository under global Repositories to create your first project."
    />
  );
}
