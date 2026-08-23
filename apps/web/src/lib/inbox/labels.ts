import {
  INBOX_SEVERITY,
  type InboxEntry,
  type InboxEntryKind,
  type InboxSeverity,
} from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

export interface InboxKindCopy {
  label: string;
  action: string;
}

export const INBOX_KIND_COPY = {
  run_failed: { label: "Run failed", action: "Resume or abandon the run" },
  run_awaiting_answer: { label: "Run is waiting for you", action: "Answer the run" },
  run_awaiting_selection: { label: "Candidates to compare", action: "Pick the candidate to keep" },
  run_review_ready: { label: "Ready to review", action: "Review the diff" },
  permission_request: { label: "Permission requested", action: "Grant or refuse the permission" },
  provider_quota: { label: "Provider quota reached", action: "Wait for the reset or resume now" },
  publication_stopped: { label: "Publication stopped", action: "Retry the publication" },
  pull_request_blocked: {
    label: "Pull request blocked",
    action: "Fix the failing checks or conflicts",
  },
  pull_request_review_requested: {
    label: "Review requested",
    action: "Review the pull request",
  },
} satisfies Record<InboxEntryKind, InboxKindCopy>;

const SEVERITY_TONE = {
  blocked: "danger",
  attention: "warning",
} satisfies Record<InboxSeverity, StatusTone>;

export function inboxEntryTone(entry: InboxEntry): StatusTone {
  return entry.state === "resolved" ? "ghost" : SEVERITY_TONE[INBOX_SEVERITY[entry.kind]];
}
