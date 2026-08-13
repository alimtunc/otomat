import { createFileRoute } from "@tanstack/react-router";
import { ExecutionDefaultsSection } from "@web/components/settings/execution-defaults/section";

export const Route = createFileRoute("/settings/execution")({
  component: ExecutionDefaultsSection,
});
