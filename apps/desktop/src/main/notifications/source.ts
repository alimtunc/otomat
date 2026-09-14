import { createDaemonClient } from "@otomat/client";
import type { ExecutionHostId } from "@otomat/domain";

import type { HostCatalog } from "../remote/host/catalog.js";
import type { NotificationDelivery } from "./controller.js";

export function pollNotifications(
  catalog: Pick<HostCatalog, "targets">,
  delivery: NotificationDelivery,
): () => void {
  let running = false;
  const poll = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const statuses = new Map<ExecutionHostId, boolean>();
      await Promise.all(
        catalog.targets().map(async ({ host, url }) => {
          statuses.set(host.id, false);
          if (url === null) return;
          try {
            const snapshot = await createDaemonClient({
              baseUrl: url,
              fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5_000) }),
            }).listNotifications();
            delivery.receive(
              { host_id: host.id, host_alias: host.kind === "ssh" ? host.label : null },
              snapshot.notifications,
            );
            statuses.set(host.id, true);
          } catch {
            statuses.set(host.id, false);
          }
        }),
      );
      delivery.sourceStatus(statuses);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void poll(), 1_000);
  void poll();
  return () => clearInterval(timer);
}
