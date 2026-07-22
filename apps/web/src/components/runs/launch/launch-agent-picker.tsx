import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { Button, EmptyState } from "@otomat/ui";
import { LaunchAgentSelect } from "@web/components/runs/launch/launch-agent-select";
import { hasLaunchableRuntime } from "@web/lib/runtimes";

export interface LaunchAgentPickerProps {
  descriptors: RuntimeDescriptor[];
  profiles: AgentProfileContract[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  onRetry: () => void;
}

/** Run-level agent chooser (profile or ad-hoc runtime) with an actionable empty/error state when no runtime is available. */
export function LaunchAgentPicker({
  descriptors,
  profiles,
  value,
  onValueChange,
  isPending,
  isError,
  isSuccess,
  onRetry,
}: LaunchAgentPickerProps) {
  if (isError) {
    return (
      <EmptyState
        variant="compact"
        tone="error"
        icon="alert-triangle"
        title="Couldn’t load agents"
        description="The daemon didn’t return its runtimes or profiles, so a run can’t be launched."
        action={
          <Button variant="outline" size="xs" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }
  if (isSuccess && !hasLaunchableRuntime(descriptors)) {
    return (
      <EmptyState
        variant="compact"
        icon="bot"
        title="No agent runtime available"
        description="Install Claude Code (npm install -g @anthropic-ai/claude-code) or Codex CLI (npm install -g @openai/codex), then check again."
        action={
          <Button variant="outline" size="xs" onClick={onRetry}>
            Check again
          </Button>
        }
      />
    );
  }
  return (
    <LaunchAgentSelect
      profiles={profiles}
      descriptors={descriptors}
      value={value}
      onValueChange={onValueChange}
      disabled={isPending}
    />
  );
}
