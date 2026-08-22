import { inboxSnapshotSchema, type InboxSnapshot } from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson } from "./http.js";

export function createInboxClient(config: DaemonClientConfig) {
  return {
    async listInbox(): Promise<InboxSnapshot> {
      return inboxSnapshotSchema.parse(await getJson(config, "/api/inbox"));
    },
  };
}
