import { createFileRoute } from "@tanstack/react-router";
import { ExecutionDefaultsSection } from "@web/components/settings/execution-defaults/section";
import { PullRequestGeneratorSection } from "@web/components/settings/pr-generator/section";

function ExecutionSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <ExecutionDefaultsSection />
      <PullRequestGeneratorSection />
    </div>
  );
}

export const Route = createFileRoute("/settings/execution")({
  component: ExecutionSettingsPage,
});
