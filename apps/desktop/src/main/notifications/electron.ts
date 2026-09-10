import { app, ipcMain, Notification, powerMonitor, shell } from "electron";

import { NOTIFICATION_CHANNELS } from "#shared/notifications";

import type { CockpitWindow } from "../cockpit-window.js";
import type { DesktopRuntime } from "../runtime.js";
import { NotificationDelivery } from "./controller.js";
import { pollNotifications } from "./source.js";
import { readNotificationState, writeNotificationState } from "./state.js";

export function startNotifications(runtime: DesktopRuntime, cockpit: CockpitWindow): void {
  const held = new Set<Notification>();
  let locked = false;
  powerMonitor.on("lock-screen", () => {
    locked = true;
  });
  powerMonitor.on("unlock-screen", () => {
    locked = false;
  });
  const delivery = new NotificationDelivery({
    read: () => readNotificationState(runtime.dataDirectory.root),
    write: (state) => writeNotificationState(runtime.dataDirectory.root, state),
    foreground: () =>
      !locked && (process.platform !== "darwin" || !app.isHidden()) && cockpit.isForeground,
    supported: () => process.platform === "darwin" && Notification.isSupported(),
    internal: (notification) => cockpit.send(NOTIFICATION_CHANNELS.notice, notification),
    open: (notification) => {
      app.show();
      cockpit.open();
      cockpit.send(NOTIFICATION_CHANNELS.open, notification);
    },
    native: (body, click, failed, shown) => {
      const notification = new Notification({ title: "Otomat", body, silent: false });
      held.add(notification);
      notification.on("click", click);
      notification.on("show", shown);
      notification.on("close", () => held.delete(notification));
      notification.on("failed", () => {
        held.delete(notification);
        failed();
      });
      notification.show();
    },
  });
  ipcMain.handle(NOTIFICATION_CHANNELS.snapshot, () => delivery.snapshot());
  ipcMain.handle(NOTIFICATION_CHANNELS.save, (_event, value: unknown) => delivery.save(value));
  ipcMain.handle(NOTIFICATION_CHANNELS.pending, () => delivery.pending());
  ipcMain.handle(NOTIFICATION_CHANNELS.acknowledge, (_event, id: unknown) =>
    delivery.acknowledge(id),
  );
  ipcMain.handle(NOTIFICATION_CHANNELS.settings, () =>
    shell.openExternal("x-apple.systempreferences:com.apple.Notifications-Settings.extension"),
  );
  app.once("will-quit", pollNotifications(runtime.hosts.catalog, delivery));
}
