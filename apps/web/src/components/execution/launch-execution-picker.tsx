import { Button, EmptyState, Field, FieldControl, FieldLabel } from "@otomat/ui";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { hasLaunchableRuntime } from "@web/lib/runtimes";
import type { ReactElement } from "react";

export interface LaunchExecutionPickerProps {
  execution: LaunchExecution;
  onChange: (value: ExecutionSelection) => void;
  label: string;
}

function ExecutionField({ children }: { children: ReactElement }) {
  return (
    <Field>
      <FieldLabel>Execution</FieldLabel>
      <FieldControl>{children}</FieldControl>
    </Field>
  );
}

export function LaunchExecutionPicker({ execution, onChange, label }: LaunchExecutionPickerProps) {
  const { agents } = execution;
  if (agents.isError) {
    return (
      <ExecutionField>
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
      </ExecutionField>
    );
  }
  if (agents.isSuccess && !hasLaunchableRuntime(agents.descriptors)) {
    return (
      <ExecutionField>
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
      </ExecutionField>
    );
  }
  return (
    <ExecutionField>
      <ExecutionConfigPicker
        level="launch"
        value={execution.selection}
        onChange={onChange}
        profiles={agents.profiles}
        descriptors={agents.descriptors}
        label={label}
        disabled={agents.isPending}
      />
    </ExecutionField>
  );
}
