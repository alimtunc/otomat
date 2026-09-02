import { asBoolean, asRecord } from "@web/lib/coerce";
import { readScoped, writeScoped, type ScopedStorage } from "@web/lib/storage";

const RUNS_VIEW_KEY = "otomat.runs-view";

export interface RunsViewConfig {
  showFailed: boolean;
  showClosedIssues: boolean;
}

export const DEFAULT_RUNS_VIEW_CONFIG: RunsViewConfig = {
  showFailed: true,
  showClosedIssues: false,
};

export function parseRunsViewConfig(value: unknown): RunsViewConfig {
  const entry = asRecord(value);
  if (entry === null) return DEFAULT_RUNS_VIEW_CONFIG;
  return {
    showFailed: asBoolean(entry.showFailed) ?? DEFAULT_RUNS_VIEW_CONFIG.showFailed,
    showClosedIssues:
      asBoolean(entry.showClosedIssues) ?? DEFAULT_RUNS_VIEW_CONFIG.showClosedIssues,
  };
}

export function readRunsViewConfig(
  projectId: string,
  storage?: ScopedStorage | null,
): RunsViewConfig {
  return readScoped(RUNS_VIEW_KEY, projectId, parseRunsViewConfig, storage);
}

export function writeRunsViewConfig(
  projectId: string,
  config: RunsViewConfig,
  storage?: ScopedStorage | null,
): void {
  writeScoped(RUNS_VIEW_KEY, projectId, config, storage);
}
