import type { ActivityEvidence } from "@otomat/domain";
import { SANDBOX_LIVE_RUN_ID, SANDBOX_REVIEW_RUN_ID } from "@web/preview/sandbox/runs";
import { SANDBOX_NOW, SANDBOX_PROJECT } from "@web/preview/sandbox/workspace";

/** The fixture rows both the activity panel and the Inbox project from, so the two agree in the preview as they do on a host. */
export const SANDBOX_RUN_EVIDENCE: ActivityEvidence[] = [
  {
    run_id: SANDBOX_LIVE_RUN_ID,
    run_status: "running",
    run_updated_at: SANDBOX_NOW,
    run_abandoned_at: null,
    run_superseded: false,
    current_step: "Review",
    halted_step: null,
    issue_id: "sandbox-issue-2",
    issue_identifier: "OTO-302",
    issue_title: "Stream run events without gaps",
    issue_status: "running",
    project_id: SANDBOX_PROJECT.id,
    project_name: SANDBOX_PROJECT.name,
    publication: null,
  },
  {
    run_id: SANDBOX_REVIEW_RUN_ID,
    run_status: "review_ready",
    run_updated_at: SANDBOX_NOW,
    run_abandoned_at: null,
    run_superseded: false,
    current_step: null,
    halted_step: null,
    issue_id: "sandbox-issue-3",
    issue_identifier: "OTO-303",
    issue_title: "Review the diff before opening a pull request",
    issue_status: "reviewing",
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
];
