import { createFileRoute } from "@tanstack/react-router";
import { UsageView } from "@web/components/usage/usage-view";
import { parseUsageSearch } from "@web/lib/usage/search";

export const Route = createFileRoute("/usage")({
  validateSearch: parseUsageSearch,
  component: UsageView,
});
