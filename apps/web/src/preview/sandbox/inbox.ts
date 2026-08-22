import { projectInbox, type InboxSnapshot } from "@otomat/domain";
import { SANDBOX_RUN_EVIDENCE } from "@web/preview/sandbox/run-evidence";
import { SANDBOX_NOW } from "@web/preview/sandbox/workspace";

export const SANDBOX_INBOX: InboxSnapshot = {
  entries: projectInbox(
    {
      runs: SANDBOX_RUN_EVIDENCE,
      pull_requests: [],
      viewer: { login: "otomat-operator", teams: [] },
    },
    { since: "2026-08-18T09:30:00.000Z", limit: 12 },
  ),
  observed_at: SANDBOX_NOW,
};
