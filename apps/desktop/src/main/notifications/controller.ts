import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationBody,
  notificationIdentity,
  notificationPreferencesSchema,
  type DesktopNotification,
  type DesktopNotificationSnapshot,
  type ExecutionHostId,
  type NotificationIntent,
} from "@otomat/domain";

import type { NotificationState } from "./state.js";

export interface NotificationDeliveryOptions {
  read(): NotificationState;
  write(state: NotificationState): void;
  foreground(): boolean;
  supported(): boolean;
  native(body: string, click: () => void, failed: () => void, shown: () => void): void;
  internal(notification: DesktopNotification): void;
  open(notification: DesktopNotification): void;
}

export class NotificationDelivery {
  private state: NotificationState | null = null;
  private readonly hydrated = new Set<string>();
  private error: string | null = null;
  private nativeError: string | null = null;
  private pendingOpen: DesktopNotification | null = null;
  private readonly sourceErrors = new Map<string, string>();

  constructor(private readonly options: NotificationDeliveryOptions) {
    try {
      this.state = options.read();
    } catch {
      this.error = "Notification preferences could not be read. Native delivery is paused.";
    }
  }

  snapshot(): DesktopNotificationSnapshot {
    let delivery: DesktopNotificationSnapshot["delivery"] = "system_managed";
    if (!this.options.supported()) delivery = "unavailable";
    else if (this.error !== null || this.nativeError !== null) delivery = "failed";
    return {
      preferences: this.state?.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
      delivery,
      error: this.error ?? this.nativeError ?? ([...this.sourceErrors.values()].join(" ") || null),
    };
  }

  save(value: unknown): DesktopNotificationSnapshot {
    const preferences = notificationPreferencesSchema.parse(value);
    if (this.state === null) throw new Error(this.error ?? "Notification state unavailable.");
    const next = { ...this.state, preferences };
    this.options.write(next);
    this.state = next;
    this.error = null;
    return this.snapshot();
  }

  pending(): DesktopNotification | null {
    return this.pendingOpen;
  }

  acknowledge(id: unknown): void {
    if (this.pendingOpen !== null && notificationIdentity(this.pendingOpen) === id)
      this.pendingOpen = null;
  }

  sourceStatus(statuses: ReadonlyMap<ExecutionHostId, boolean>): void {
    this.sourceErrors.clear();
    for (const [hostId, available] of statuses) {
      if (!available)
        this.sourceErrors.set(
          hostId,
          `Notifications from the ${hostId} host are unavailable. Reconnecting automatically.`,
        );
    }
  }

  receive(
    host: Pick<DesktopNotification, "host_id" | "host_alias">,
    intents: NotificationIntent[],
  ): void {
    if (this.state === null) return;
    const source = JSON.stringify([host.host_id, host.host_alias]);
    const seen = new Set(this.state.seen);
    const fresh = intents.filter((intent) => {
      const key = notificationIdentity({ ...intent, ...host });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length > 0) {
      const next = { ...this.state, seen: [...seen] };
      try {
        this.options.write(next);
        this.state = next;
        this.error = null;
      } catch {
        this.error =
          "Notification history could not be saved. Delivery is paused to avoid duplicates.";
        return;
      }
    }
    const initialized = this.hydrated.has(source);
    this.hydrated.add(source);
    if (!initialized) return;
    for (const intent of fresh) this.deliver({ ...intent, ...host });
  }

  private deliver(notification: DesktopNotification): void {
    if (this.state === null) return;
    if (this.options.foreground()) {
      this.options.internal(notification);
      return;
    }
    if (!this.state.preferences.categories[notification.category] || !this.options.supported()) {
      return;
    }
    const failed = (): void => {
      this.nativeError =
        "macOS could not deliver a notification. Check Otomat in System Settings → Notifications and ensure the app is signed.";
    };
    try {
      this.options.native(
        notificationBody(notification.category, this.state.preferences.detail),
        () => {
          this.pendingOpen = notification;
          this.options.open(notification);
        },
        failed,
        () => {
          this.nativeError = null;
        },
      );
    } catch {
      failed();
    }
  }
}
