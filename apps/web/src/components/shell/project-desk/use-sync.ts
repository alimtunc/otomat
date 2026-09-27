import { useSelector } from "@tanstack/react-store";
import { projectSelectionStore } from "@web/components/shell/project-selection/store";
import { useEffect } from "react";

import { projectDeskStore } from "./store";
import { useDeskRoute } from "./use-route";

export function useDeskSync() {
  const route = useDeskRoute();
  const pending = useSelector(projectDeskStore, (state) => state.pending);
  const { key, projectId, host, href, label, scoped } = route;
  // otomat-allow-effect: the router's committed location and resolved entity determine the owning project.
  useEffect(() => {
    if (!scoped || key === undefined || projectId === undefined) return;
    if (!projectDeskStore.actions.record(key, { href, label })) return;
    if (projectSelectionStore.state.get(host) !== projectId)
      projectSelectionStore.actions.select(host, projectId);
  }, [key, projectId, host, href, label, scoped, pending]);
  return route;
}
