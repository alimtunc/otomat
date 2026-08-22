import { projectActivities, type ActivitySnapshot } from "@otomat/domain";
import { SANDBOX_RUN_EVIDENCE } from "@web/preview/sandbox/run-evidence";
import { SANDBOX_NOW } from "@web/preview/sandbox/workspace";

/** Projected from fixture rows through the real reducer, so the sandbox panel groups exactly as a daemon's does. */
export const SANDBOX_ACTIVITY: ActivitySnapshot = {
  activities: projectActivities(SANDBOX_RUN_EVIDENCE, {
    since: "2026-08-19T03:30:00.000Z",
    limit: 8,
  }),
  observed_at: SANDBOX_NOW,
};
