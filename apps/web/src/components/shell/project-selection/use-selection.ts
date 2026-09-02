import type { ProjectSummary } from "@otomat/ui";
import { useSelector } from "@tanstack/react-store";
import { resolveSelectedProjectId } from "@web/components/shell/project-selection/selection";
import { projectSelectionStore } from "@web/components/shell/project-selection/store";
import { useActiveHostId } from "@web/lib/active-host";

export function useProjectSelection(projects: ProjectSummary[]): string | undefined {
  const host = useActiveHostId();
  const preferredProjectId = useSelector(projectSelectionStore, (ids) => ids.get(host));
  return resolveSelectedProjectId(projects, preferredProjectId);
}
