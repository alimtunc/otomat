import { inboxSnapshotSchema, type InboxSnapshot, type MarkInboxRequest } from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson } from "./http.js";

export function createInboxClient(config: DaemonClientConfig) {
  return {
    async listInbox(): Promise<InboxSnapshot> {
      return inboxSnapshotSchema.parse(await getJson(config, "/api/inbox"));
    },
    async markInbox(request: MarkInboxRequest): Promise<InboxSnapshot> {
      return inboxSnapshotSchema.parse(await postJson(config, "/api/inbox/marks", request));
    },
  };
}
