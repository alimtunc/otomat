import type { RunDiffScope } from "@otomat/domain";

export const BRANCH_SCOPE: RunDiffScope = {
  kind: "branch",
  branch: "otomat/run/x",
  base_ref: "main",
};
