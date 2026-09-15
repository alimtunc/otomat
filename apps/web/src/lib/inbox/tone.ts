import { INBOX_SEVERITY, type InboxEntry, type InboxSeverity } from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

const SEVERITY_TONE = {
  blocked: "danger",
  attention: "warning",
} satisfies Record<InboxSeverity, StatusTone>;

export function inboxEntryTone(entry: InboxEntry): StatusTone {
  return entry.state === "resolved" ? "ghost" : SEVERITY_TONE[INBOX_SEVERITY[entry.kind]];
}
