import { Button, ErrorState, Skeleton, toast } from "@otomat/ui";
import { NotificationPreferencesForm } from "@web/components/settings/notifications/form";
import { useNotificationSettings } from "@web/components/settings/notifications/use-notification-settings";
import { SectionHeading } from "@web/components/settings/section-heading";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function NotificationsSection() {
  const { bridge, query, save } = useNotificationSettings();
  return (
    <div>
      <SectionHeading
        title="Notifications"
        description="Native notifications on this Mac. Inbox and Activity remain available in Otomat."
      />
      {bridge === null ? (
        <p>Native notifications are available in the macOS desktop app.</p>
      ) : (
        <QueryBoundary
          query={query}
          pending={<Skeleton height={32} />}
          error={
            <ErrorState
              variant="inline"
              title="Notification settings are unavailable."
              onRetry={() => void query.refetch()}
            />
          }
        >
          {(snapshot) => (
            <>
              <p className="mb-3 text-sm text-text-secondary" role="status">
                {snapshot.error ??
                  (snapshot.delivery === "unavailable"
                    ? "Native notifications are unavailable on this platform."
                    : "macOS manages notification access. Otomat cannot read its authorization status. If access is denied, enable Otomat in System Settings → Notifications.")}
              </p>
              <Button
                className="mb-4"
                disabled={snapshot.delivery === "unavailable"}
                onClick={() =>
                  void bridge.notifications
                    .openSettings()
                    .catch(() => toast.error("Could not open macOS notification settings."))
                }
              >
                Open macOS settings
              </Button>
              <NotificationPreferencesForm preferences={snapshot.preferences} save={save} />
            </>
          )}
        </QueryBoundary>
      )}
    </div>
  );
}
