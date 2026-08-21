import { activitySnapshotSchema, type ActivitySnapshot } from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { deliverFrame, openEventSource } from "./event-source.js";
import { getJson } from "./http.js";

export interface ActivityStreamHandlers {
  onSnapshot(snapshot: ActivitySnapshot): void;
  onOpen?(): void;
  onError?(error: Event): void;
  onParseError?(error: unknown): void;
}

export interface ActivityStreamSubscription {
  close(): void;
}

export function createActivityClient(config: DaemonClientConfig) {
  return {
    async listActivity(): Promise<ActivitySnapshot> {
      return activitySnapshotSchema.parse(await getJson(config, "/api/activity"));
    },
    subscribeActivity(handlers: ActivityStreamHandlers): ActivityStreamSubscription {
      const source = openEventSource(config, "/api/activity/stream");
      source.addEventListener("snapshot", (event) =>
        deliverFrame(event, activitySnapshotSchema, handlers.onSnapshot, handlers.onParseError),
      );
      source.addEventListener("open", () => handlers.onOpen?.());
      source.addEventListener("error", (event) => handlers.onError?.(event));
      return { close: () => source.close() };
    },
  };
}
