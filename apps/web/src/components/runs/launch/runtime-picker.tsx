import type { RuntimeDescriptor } from "@otomat/domain";
import { Button, EmptyState } from "@otomat/ui";
import { RuntimeSelect } from "@web/components/runs/launch/runtime-select";
import { hasLaunchableRuntime } from "@web/lib/runtimes";

export interface RuntimePickerProps {
  descriptors: RuntimeDescriptor[];
  value: string | null;
  onValueChange: (runtime: string) => void;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  onRetry: () => void;
}

/** Runtime chooser, or an actionable empty/error state when the daemon offers none. Presentational — the caller owns the query. */
export function RuntimePicker({
  descriptors,
  value,
  onValueChange,
  isPending,
  isError,
  isSuccess,
  onRetry,
}: RuntimePickerProps) {
  if (isError) {
    return (
      <EmptyState
        variant="compact"
        tone="error"
        icon="alert-triangle"
        title="Couldn’t load runtimes"
        description="The daemon didn’t return its runtime list, so a run can’t be launched."
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
    <RuntimeSelect
      descriptors={descriptors}
      value={value}
      onValueChange={onValueChange}
      disabled={isPending}
    />
  );
}
