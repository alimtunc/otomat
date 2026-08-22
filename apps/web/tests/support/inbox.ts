import type { InboxEntry } from "@otomat/domain";

const UPDATED_AT = "2026-08-22T10:00:00.000Z";

export function inboxEntry(overrides: Partial<InboxEntry> = {}): InboxEntry {
  return {
    id: "run:run-1",
    kind: "run_failed",
    state: "open",
    project: { id: "p1", name: "Otomat" },
    subject: { title: "Ship it", identifier: "OTO-1" },
    target: { kind: "run", run_id: "run-1" },
    detail: "Check",
    updated_at: UPDATED_AT,
    ...overrides,
  };
}
