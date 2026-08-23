import {
  DEFAULT_RUNS_VIEW_CONFIG,
  readRunsViewConfig,
  writeRunsViewConfig,
  type RunsViewConfig,
} from "@web/lib/run/view-config";
import { useState } from "react";

export interface RunsViewResult {
  config: RunsViewConfig;
  update: (patch: Partial<RunsViewConfig>) => void;
}

function storedConfig(projectId: string | undefined): RunsViewConfig {
  return projectId === undefined ? DEFAULT_RUNS_VIEW_CONFIG : readRunsViewConfig(projectId);
}

export function useRunsView(projectId: string | undefined): RunsViewResult {
  const [state, setState] = useState(() => ({ projectId, config: storedConfig(projectId) }));
  if (state.projectId !== projectId) setState({ projectId, config: storedConfig(projectId) });

  return {
    config: state.config,
    update: (patch) => {
      const config = { ...state.config, ...patch };
      setState({ projectId, config });
      if (projectId !== undefined) writeRunsViewConfig(projectId, config);
    },
  };
}
