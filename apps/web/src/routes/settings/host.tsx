import { createFileRoute } from "@tanstack/react-router";
import { ExecutionHostSection } from "@web/components/settings/execution-host/section";

export const Route = createFileRoute("/settings/host")({
  component: ExecutionHostSection,
});
