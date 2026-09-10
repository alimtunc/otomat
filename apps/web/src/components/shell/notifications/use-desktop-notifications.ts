import {
  desktopNotificationSchema,
  NOTIFICATION_HEADLINES,
  notificationIdentity,
  type DesktopNotification,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { shellKeys } from "@web/api/query-keys";
import {
  notificationRoute,
  selectNotificationProject,
} from "@web/components/shell/notifications/navigation";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { useEffect } from "react";

export function useDesktopNotifications(): void {
  const bridge = desktopBridge();
  const navigate = useNavigate();
  const client = useQueryClient();

  // otomat-allow-effect: the shell delivers native clicks and foreground notices outside React's lifecycle.
  useEffect(() => {
    if (bridge === null) return;
    let active = true;
    const opening = new Set<string>();
    const open = async (value: DesktopNotification): Promise<void> => {
      const parsed = desktopNotificationSchema.safeParse(value);
      if (!parsed.success) {
        toast.error("The notification destination is invalid.");
        return;
      }
      const notification = parsed.data;
      const key = notificationIdentity(notification);
      if (!active || opening.has(key)) return;
      opening.add(key);
      try {
        await selectNotificationProject(bridge, notification);
        await client.invalidateQueries({ queryKey: shellKeys.executionHost });
        if (!active) return;
        await navigate(notificationRoute(notification));
        await bridge.notifications.acknowledge(key);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open the notification.", {
          action: { label: "Retry", onClick: () => void open(notification) },
        });
      } finally {
        opening.delete(key);
      }
    };
    const unsubscribeOpen = bridge.notifications.onOpen((notification) => void open(notification));
    const unsubscribeNotice = bridge.notifications.onNotice((notification) => {
      toast(NOTIFICATION_HEADLINES[notification.category], {
        action: { label: "Open", onClick: () => void open(notification) },
      });
    });
    void bridge.notifications
      .pending()
      .then((pending) => {
        if (pending !== null) void open(pending);
      })
      .catch(() => toast.error("Could not restore the notification destination."));
    return () => {
      active = false;
      unsubscribeOpen();
      unsubscribeNotice();
    };
  }, [bridge, client, navigate]);
}
