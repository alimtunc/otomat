import { Button, EmptyState } from "@otomat/ui";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import type { AgentScope } from "@web/lib/agent-choice";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { hasLaunchableRuntime } from "@web/lib/runtimes";

export interface LaunchExecutionPickerProps {
  execution: LaunchExecution;
  onChange: (value: ExecutionSelection) => void;
  label: string;
  scope?: AgentScope;
}

export function LaunchExecutionPicker({
  execution,
  onChange,
  label,
  scope = "all",
}: LaunchExecutionPickerProps) {
  const { agents } = execution;
  if (agents.isError) {
    return (
      <EmptyState
        variant="compact"
        tone="error"
        icon="alert-triangle"
        title="Couldn’t load agents"
        description="The daemon didn’t return its runtimes or profiles, so a run can’t be launched."
        action={
          <Button variant="outline" size="xs" onClick={agents.onRetry}>
            Retry
          </Button>
        }
      />
    );
  }
  if (agents.isSuccess && !hasLaunchableRuntime(agents.descriptors)) {
    return (
      <EmptyState
        variant="compact"
        icon="bot"
        title="No agent runtime available"
        description="Install Claude Code (npm install -g @anthropic-ai/claude-code) or Codex CLI (npm install -g @openai/codex), then check again."
        action={
          <Button variant="outline" size="xs" onClick={agents.onRetry}>
            Check again
          </Button>
        }
      />
    );
  }
  return (
    <ExecutionConfigPicker
      level="launch"
      value={execution.selection}
      onChange={onChange}
      profiles={agents.profiles}
      descriptors={agents.descriptors}
      label={label}
      scope={scope}
      disabled={agents.isPending}
    />
  );
}
