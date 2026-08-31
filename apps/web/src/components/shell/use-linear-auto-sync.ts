import { focusManager } from "@tanstack/react-query";
import { useProjectLinearSync } from "@web/api/linear/use-project-sync";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { useEffect } from "react";

export function useLinearAutoSync(): void {
  const { projectId } = useSelectedProject();
  const { refreshIfStale } = useProjectLinearSync(projectId);

  // otomat-allow-effect: the selected project changing is an external transition.
  useEffect(() => {
    refreshIfStale();
  }, [projectId, refreshIfStale]);

  // otomat-allow-effect: rides the foreground signal every query refetch already uses.
  useEffect(
    () =>
      focusManager.subscribe((focused) => {
        if (focused) refreshIfStale();
      }),
    [refreshIfStale],
  );
}
