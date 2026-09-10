import type { DesktopNotificationsBridge } from "@otomat/domain";
import { ipcRenderer } from "electron";

import { NOTIFICATION_CHANNELS } from "#shared/notifications";

import { subscribe } from "./subscribe.js";

export const notifications: DesktopNotificationsBridge = {
  snapshot: () => ipcRenderer.invoke(NOTIFICATION_CHANNELS.snapshot),
  save: (preferences) => ipcRenderer.invoke(NOTIFICATION_CHANNELS.save, preferences),
  openSettings: () => ipcRenderer.invoke(NOTIFICATION_CHANNELS.settings),
  pending: () => ipcRenderer.invoke(NOTIFICATION_CHANNELS.pending),
  acknowledge: (id) => ipcRenderer.invoke(NOTIFICATION_CHANNELS.acknowledge, id),
  onNotice: (listener) => subscribe(NOTIFICATION_CHANNELS.notice, listener),
  onOpen: (listener) => subscribe(NOTIFICATION_CHANNELS.open, listener),
};
