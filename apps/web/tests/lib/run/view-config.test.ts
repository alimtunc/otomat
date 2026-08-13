import {
  DEFAULT_RUNS_VIEW_CONFIG,
  parseRunsViewConfig,
  readRunsViewConfig,
  writeRunsViewConfig,
} from "@web/lib/run/view-config";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

describe("runs view config", () => {
  it("hides done issues and keeps failed runs by default", () => {
    expect(DEFAULT_RUNS_VIEW_CONFIG).toEqual({ showFailed: true, showDoneIssues: false });
    expect(parseRunsViewConfig({ showFailed: "yes" })).toEqual(DEFAULT_RUNS_VIEW_CONFIG);
    expect(parseRunsViewConfig(null)).toEqual(DEFAULT_RUNS_VIEW_CONFIG);
  });

  it("restores a project's filters without reaching another project", () => {
    const storage = memoryStorage();
    writeRunsViewConfig("project-1", { showFailed: false, showDoneIssues: true }, storage);
    expect(readRunsViewConfig("project-1", storage)).toEqual({
      showFailed: false,
      showDoneIssues: true,
    });
    expect(readRunsViewConfig("project-2", storage)).toEqual(DEFAULT_RUNS_VIEW_CONFIG);
  });
});
