import { listConversationEvidence, listInboxMarks, type Db } from "@otomat/db";
import { projectConversations, type ConversationSnapshot } from "@otomat/domain";

/** How long a finished thread stays listed: the same day the Inbox keeps a resolved demand. */
const FINISHED_WINDOW_MS = 24 * 60 * 60 * 1000;

export function readConversations(db: Db): ConversationSnapshot {
  const observed = new Date();
  const since = new Date(observed.getTime() - FINISHED_WINDOW_MS).toISOString();
  return {
    entries: projectConversations(listConversationEvidence(db, since), listInboxMarks(db)),
    observed_at: observed.toISOString(),
  };
}
