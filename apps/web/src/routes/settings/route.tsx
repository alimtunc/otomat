import { createFileRoute } from "@tanstack/react-router";
import { SettingsLayout } from "@web/components/settings/settings-layout";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});
