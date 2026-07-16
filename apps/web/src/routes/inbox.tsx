import { createFileRoute } from "@tanstack/react-router";
import { InboxView } from "@web/components/inbox/inbox-view";

export const Route = createFileRoute("/inbox")({
  component: InboxView,
});
