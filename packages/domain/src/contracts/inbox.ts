import { z } from "zod";

export const INBOX_ENTRY_KINDS = [
  "run_failed",
  "run_awaiting_answer",
  "run_awaiting_selection",
  "run_review_ready",
  "permission_request",
  "provider_quota",
  "publication_stopped",
  "pull_request_blocked",
  "pull_request_review_requested",
] as const;
export const inboxEntryKindSchema = z.enum(INBOX_ENTRY_KINDS);
export type InboxEntryKind = z.infer<typeof inboxEntryKindSchema>;

export const INBOX_SEVERITIES = ["blocked", "attention"] as const;
export type InboxSeverity = (typeof INBOX_SEVERITIES)[number];

/** `blocked` is work that broke; `attention` is work parked on a decision only the operator can make. */
export const INBOX_SEVERITY = {
  run_failed: "blocked",
  run_awaiting_answer: "attention",
  run_awaiting_selection: "attention",
  run_review_ready: "attention",
  permission_request: "attention",
  provider_quota: "attention",
  publication_stopped: "blocked",
  pull_request_blocked: "blocked",
  pull_request_review_requested: "attention",
} satisfies Record<InboxEntryKind, InboxSeverity>;

export const INBOX_ENTRY_STATES = ["open", "resolved"] as const;
export const inboxEntryStateSchema = z.enum(INBOX_ENTRY_STATES);
export type InboxEntryState = z.infer<typeof inboxEntryStateSchema>;

/** The surface carrying both the durable evidence and the control that acts on it. */
export const inboxTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("run"), run_id: z.string().min(1) }),
  z.object({ kind: z.literal("run_pull_request"), run_id: z.string().min(1) }),
  z.object({ kind: z.literal("pull_request"), pull_request_id: z.string().min(1) }),
]);
export type InboxTarget = z.infer<typeof inboxTargetSchema>;

/** What the entry is about: the issue that anchors it, or the pull request itself when none does. */
const inboxSubjectSchema = z.object({
  title: z.string(),
  identifier: z.string().nullable(),
});

export const inboxEntrySchema = z.object({
  /** Derived from the cause, so one incident can only ever occupy one entry. */
  id: z.string().min(1),
  kind: inboxEntryKindSchema,
  state: inboxEntryStateSchema,
  project: z.object({ id: z.string().min(1), name: z.string() }),
  subject: inboxSubjectSchema,
  target: inboxTargetSchema,
  /** What the evidence itself says — an error, a halted step — when the kind alone does not say it. */
  detail: z.string().nullable(),
  /** When the evidence last changed; the age the operator reads is measured from it. */
  updated_at: z.iso.datetime(),
});
export type InboxEntry = z.infer<typeof inboxEntrySchema>;

export const inboxSnapshotSchema = z.object({
  entries: z.array(inboxEntrySchema),
  observed_at: z.iso.datetime(),
});
export type InboxSnapshot = z.infer<typeof inboxSnapshotSchema>;
