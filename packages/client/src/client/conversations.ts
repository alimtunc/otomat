import { conversationSnapshotSchema, type ConversationSnapshot } from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deliverFrame, openEventSource } from "./event-source.js";
import { getJson } from "./http.js";

export interface ConversationStreamHandlers {
  onSnapshot(snapshot: ConversationSnapshot): void;
  onOpen?(): void;
  onError?(error: Event): void;
  onParseError?(error: unknown): void;
}

export interface ConversationStreamSubscription {
  close(): void;
}

export function createConversationsClient(config: DaemonClientConfig) {
  return {
    async listConversations(): Promise<ConversationSnapshot> {
      return conversationSnapshotSchema.parse(await getJson(config, "/api/conversations"));
    },
    subscribeConversations(handlers: ConversationStreamHandlers): ConversationStreamSubscription {
      const source = openEventSource(config, "/api/conversations/stream");
      source.addEventListener("snapshot", (event) =>
        deliverFrame(event, conversationSnapshotSchema, handlers.onSnapshot, handlers.onParseError),
      );
      source.addEventListener("open", () => handlers.onOpen?.());
      source.addEventListener("error", (event) => handlers.onError?.(event));
      return { close: () => source.close() };
    },
  };
}
