import { createStore } from "@tanstack/react-store";
import {
  readSelectedProjectId,
  writeSelectedProjectId,
} from "@web/components/shell/project-selection";

export const projectSelectionStore = createStore(readSelectedProjectId(), ({ setState }) => ({
  select(projectId: string): void {
    setState(() => projectId);
    writeSelectedProjectId(projectId);
  },
}));
