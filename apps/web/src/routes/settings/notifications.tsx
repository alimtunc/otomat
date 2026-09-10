import { createFileRoute } from "@tanstack/react-router";
import { NotificationsSection } from "@web/components/settings/notifications/section";

export const Route = createFileRoute("/settings/notifications")({
  component: NotificationsSection,
});
