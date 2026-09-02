import type { ExecutionHostId } from "@otomat/domain";
import { createStore } from "@tanstack/react-store";
import {
  readSelectedProjectIds,
  writeSelectedProjectId,
} from "@web/components/shell/project-selection/selection";

export const projectSelectionStore = createStore(readSelectedProjectIds(), ({ setState }) => ({
  select(hostId: ExecutionHostId, projectId: string): void {
    setState((ids) => new Map(ids).set(hostId, projectId));
    writeSelectedProjectId(hostId, projectId);
  },
}));
