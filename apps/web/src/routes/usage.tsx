import { createFileRoute } from "@tanstack/react-router";
import { UsageView } from "@web/components/usage/usage-view";

export const Route = createFileRoute("/usage")({
  component: UsageView,
});
