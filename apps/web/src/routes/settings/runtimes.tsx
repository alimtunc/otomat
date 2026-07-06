import { createFileRoute } from "@tanstack/react-router";
import { RuntimesSection } from "@web/components/settings/runtimes/section";

export const Route = createFileRoute("/settings/runtimes")({
  component: RuntimesSection,
});
