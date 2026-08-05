import { createFileRoute } from "@tanstack/react-router";
import { SandboxSection } from "@web/components/settings/sandbox/section";

export const Route = createFileRoute("/settings/sandbox")({
  component: SandboxSection,
});
