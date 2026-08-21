import { projectActivities, type ActivitySnapshot } from "@otomat/domain";
import { SANDBOX_LIVE_RUN_ID, SANDBOX_REVIEW_RUN_ID } from "@web/preview/sandbox/runs";
import { SANDBOX_NOW, SANDBOX_PROJECT } from "@web/preview/sandbox/workspace";

/** Projected from fixture rows through the real reducer, so the sandbox panel groups exactly as a daemon's does. */
export const SANDBOX_ACTIVITY: ActivitySnapshot = {
  activities: projectActivities(
    [
      {
        run_id: SANDBOX_LIVE_RUN_ID,
        run_status: "running",
        run_updated_at: SANDBOX_NOW,
        current_step: "Review",
        halted_step: null,
        issue_id: "sandbox-issue-2",
        issue_identifier: "OTO-302",
        issue_title: "Stream run events without gaps",
        project_id: SANDBOX_PROJECT.id,
        project_name: SANDBOX_PROJECT.name,
        publication: null,
      },
      {
        run_id: SANDBOX_REVIEW_RUN_ID,
        run_status: "review_ready",
        run_updated_at: SANDBOX_NOW,
        current_step: null,
        halted_step: null,
        issue_id: "sandbox-issue-3",
        issue_identifier: "OTO-303",
        issue_title: "Review the diff before opening a pull request",
        project_id: SANDBOX_PROJECT.id,
        project_name: SANDBOX_PROJECT.name,
        publication: {
          id: "sandbox-pr-1",
          publication_status: "pushing",
          failed_phase: null,
          error_code: null,
          error_message: null,
          updated_at: SANDBOX_NOW,
        },
      },
    ],
    { since: "2026-08-19T03:30:00.000Z", limit: 8 },
  ),
  observed_at: SANDBOX_NOW,
};
