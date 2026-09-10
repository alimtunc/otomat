import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationIdentity,
  type NotificationIntent,
} from "@otomat/domain";
import { expect, it, vi } from "vitest";

import {
  NotificationDelivery,
  type NotificationDeliveryOptions,
} from "#main/notifications/controller";
import type { NotificationState } from "#main/notifications/state";

const HOST = { host_id: "local", host_alias: null } as const;
const INTENT: NotificationIntent = {
  id: "interaction:one",
  category: "permission",
  project_id: "project",
  target: { kind: "run", run_id: "run" },
  step_run_id: "step",
  interaction_id: "one",
};

function harness() {
  let saved: NotificationState = {
    preferences: structuredClone(DEFAULT_NOTIFICATION_PREFERENCES),
    seen: [],
  };
  const options = {
    read: () => saved,
    write: vi.fn((state: NotificationState) => {
      saved = state;
    }),
    foreground: vi.fn(() => false),
    supported: vi.fn(() => true),
    native: vi.fn<NotificationDeliveryOptions["native"]>(),
    internal: vi.fn(),
    open: vi.fn(),
  };
  const delivery = new NotificationDelivery(options);
  delivery.receive(HOST, []);
  return { options, delivery };
}

it("delivers one native notification outside focus, deduplicating replay and refresh", () => {
  const { options, delivery } = harness();
  delivery.receive(HOST, [INTENT, INTENT]);
  delivery.receive(HOST, []);
  delivery.receive(HOST, [INTENT]);
  expect(options.native).toHaveBeenCalledOnce();
  expect(options.internal).not.toHaveBeenCalled();
  expect(options.write.mock.invocationCallOrder[0]).toBeLessThan(
    options.native.mock.invocationCallOrder[0],
  );
  const restarted = new NotificationDelivery(options);
  restarted.receive(HOST, []);
  restarted.receive(HOST, [INTENT]);
  expect(options.native).toHaveBeenCalledOnce();
});

it("keeps foreground events internal and never announces them later after blur", () => {
  const { options, delivery } = harness();
  options.foreground.mockReturnValue(true);
  delivery.receive(HOST, [INTENT]);
  options.foreground.mockReturnValue(false);
  delivery.receive(HOST, [INTENT]);
  expect(options.internal).toHaveBeenCalledExactlyOnceWith({ ...INTENT, ...HOST });
  expect(options.native).not.toHaveBeenCalled();
});

it("silences initial hydration but distinguishes two requests in the same run", () => {
  const { options } = harness();
  const delivery = new NotificationDelivery(options);
  delivery.receive(HOST, [INTENT]);
  expect(options.native).not.toHaveBeenCalled();
  delivery.receive(HOST, [INTENT, { ...INTENT, id: "interaction:two", interaction_id: "two" }]);
  expect(options.native).toHaveBeenCalledOnce();
});

it("consumes disabled and unsupported notifications without errors or delayed alerts", () => {
  const { options, delivery } = harness();
  delivery.save({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    categories: { ...DEFAULT_NOTIFICATION_PREFERENCES.categories, permission: false },
  });
  delivery.receive(HOST, [INTENT]);
  delivery.save(DEFAULT_NOTIFICATION_PREFERENCES);
  delivery.receive(HOST, [INTENT]);
  expect(options.native).not.toHaveBeenCalled();
  options.supported.mockReturnValue(false);
  delivery.receive(HOST, [{ ...INTENT, id: "unsupported" }]);
  expect(delivery.snapshot().delivery).toBe("unavailable");
  expect(options.native).not.toHaveBeenCalled();
});

it("keeps a click pending until the renderer has opened the exact entity", () => {
  const { options, delivery } = harness();
  delivery.receive(HOST, [INTENT]);
  const click = options.native.mock.calls[0][1];
  click();
  expect(options.open).toHaveBeenCalledWith({ ...INTENT, ...HOST });
  expect(delivery.pending()).toEqual({ ...INTENT, ...HOST });
  delivery.acknowledge("another");
  expect(delivery.pending()).not.toBeNull();
  delivery.acknowledge(notificationIdentity({ ...INTENT, ...HOST }));
  expect(delivery.pending()).toBeNull();
});

it("reports native failures and keeps the durable event consumed", () => {
  const { options, delivery } = harness();
  delivery.receive(HOST, [INTENT]);
  options.native.mock.calls[0][2]();
  expect(delivery.snapshot()).toMatchObject({
    delivery: "failed",
    error: expect.stringContaining("System Settings"),
  });
  delivery.receive(HOST, [INTENT]);
  expect(options.native).toHaveBeenCalledOnce();
  delivery.save(DEFAULT_NOTIFICATION_PREFERENCES);
  delivery.receive(HOST, [{ ...INTENT, id: "second" }]);
  expect(delivery.snapshot().delivery).toBe("failed");
  options.native.mock.calls[1][3]();
  expect(delivery.snapshot()).toMatchObject({ delivery: "system_managed", error: null });
});

it("pauses delivery when persisting deduplication fails, and refuses failed preference saves", () => {
  const { options, delivery } = harness();
  const failure = new Error("disk full");
  const failWrite = (): never => {
    throw failure;
  };
  options.write.mockImplementationOnce(failWrite).mockImplementationOnce(failWrite);
  delivery.receive(HOST, [INTENT]);
  expect(options.native).not.toHaveBeenCalled();
  expect(delivery.snapshot().error).toContain("history could not be saved");
  expect(() => delivery.save(DEFAULT_NOTIFICATION_PREFERENCES)).toThrow("disk full");
  delivery.receive(HOST, [INTENT]);
  expect(options.native).toHaveBeenCalledOnce();
  expect(delivery.snapshot().error).toBeNull();
});

it("uses only fixed copy for both privacy levels and isolates host identities", () => {
  const { options, delivery } = harness();
  const sensitive = {
    ...INTENT,
    project_id: "/private/secret",
    prompt: "private prompt",
    code: "secret code",
    answer: "private answer",
  };
  delivery.receive(HOST, [sensitive]);
  expect(options.native.mock.calls[0][0]).toBe("Open Otomat to view an update.");
  delivery.save({ ...DEFAULT_NOTIFICATION_PREFERENCES, detail: "category" });
  const remote = { host_id: "remote", host_alias: "vps" } as const;
  delivery.receive(remote, []);
  delivery.receive(remote, [sensitive]);
  expect(options.native.mock.calls[1][0]).toBe("Permission or choice requested");
});
