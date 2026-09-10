import { DEFAULT_NOTIFICATION_PREFERENCES } from "@otomat/domain";
import { afterEach, expect, it, vi } from "vitest";

import { NotificationDelivery } from "#main/notifications/controller";
import { pollNotifications } from "#main/notifications/source";
import type { HostTarget } from "#main/remote/host/catalog";

afterEach(() => vi.useRealTimers());

it("reports disconnected hosts and clears the error when a host is removed", async () => {
  vi.useFakeTimers();
  const delivery = new NotificationDelivery({
    read: () => ({ preferences: DEFAULT_NOTIFICATION_PREFERENCES, seen: [] }),
    write: vi.fn(),
    foreground: () => false,
    supported: () => true,
    native: vi.fn(),
    internal: vi.fn(),
    open: vi.fn(),
  });
  const targets = vi.fn<() => HostTarget[]>(() => [
    {
      host: { id: "remote", label: "vps", kind: "ssh" },
      active: false,
      status: { phase: "disconnected", detail: null },
      url: null,
    },
  ]);
  const stop = pollNotifications({ targets }, delivery);
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(delivery.snapshot().error).toContain("remote host are unavailable");
    targets.mockReturnValue([]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(delivery.snapshot().error).toBeNull();
  } finally {
    stop();
  }
});
