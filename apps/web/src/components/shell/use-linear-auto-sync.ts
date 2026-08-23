import { focusManager } from "@tanstack/react-query";
import { useLinearConnection } from "@web/api/linear/queries";
import { useProjectLinearSync } from "@web/api/linear/use-project-sync";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { useEffect } from "react";

export function useLinearAutoSync(): void {
  const { projectId } = useSelectedProject();
  const connection = useLinearConnection();
  const connected = connection.data?.status === "connected";
  const { refreshIfStale } = useProjectLinearSync(projectId);

  // otomat-allow-effect: the connection turning usable and the project changing are external transitions.
  useEffect(() => {
    if (!connected) return;
    refreshIfStale();
  }, [connected, projectId, refreshIfStale]);

  // otomat-allow-effect: rides the foreground signal every query refetch already uses.
  useEffect(
    () =>
      focusManager.subscribe((focused) => {
        if (focused && connected) refreshIfStale();
      }),
    [connected, refreshIfStale],
  );
}
