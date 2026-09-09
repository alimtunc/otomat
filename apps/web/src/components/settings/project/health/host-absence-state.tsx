import { EmptyState } from "@otomat/ui";
import type { ProjectHealthAbsence } from "@web/components/settings/project/health/use-project-health";

export function HostAbsenceState({ absence }: { absence: ProjectHealthAbsence }) {
  if (absence === "unreachable") {
    return (
      <EmptyState
        icon="plug"
        variant="inline"
        tone="error"
        title="This host did not answer"
        description="Its checks could not run, so nothing is known about this project there. The other hosts' results are untouched."
      />
    );
  }
  return (
    <EmptyState
      icon="folder-git-2"
      variant="inline"
      title="Not registered on this host"
      description="No project with this repository path exists here, so this host cannot launch runs for it. Register the repository on that host to use it."
    />
  );
}
