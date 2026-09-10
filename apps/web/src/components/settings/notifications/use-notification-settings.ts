import type { NotificationPreferences } from "@otomat/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { desktopBridge, requireDesktopBridge } from "@web/lib/desktop-bridge";

const QUERY_KEY = ["desktop-notifications"] as const;

export function useNotificationSettings() {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled: bridge !== null,
    queryFn: () => requireDesktopBridge(bridge).notifications.snapshot(),
    refetchInterval: 5_000,
  });
  const save = useMutation({
    mutationFn: (value: NotificationPreferences) =>
      requireDesktopBridge(bridge).notifications.save(value),
    onSuccess: (snapshot) => client.setQueryData(QUERY_KEY, snapshot),
  });
  return { bridge, query, save };
}

export type NotificationSettingsResult = ReturnType<typeof useNotificationSettings>;
