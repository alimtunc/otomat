import { createStore } from "@tanstack/react-store";
import {
  readSelectedProjectId,
  writeSelectedProjectId,
} from "@web/components/shell/project-selection/selection";
import { activeExecutionHostId } from "@web/lib/desktop-bridge";

export const projectSelectionStore = createStore(
  readSelectedProjectId(activeExecutionHostId()),
  ({ setState }) => ({
    select(projectId: string): void {
      setState(() => projectId);
      writeSelectedProjectId(activeExecutionHostId(), projectId);
    },
  }),
);
