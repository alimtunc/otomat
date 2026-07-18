import type { RunContract } from "@otomat/domain";
import { Button, Icon, Popover, PopoverContent, PopoverTrigger, toast } from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { startRunErrorMessage, useStartRun } from "@web/api/runs/mutations";
import { RuntimePicker } from "@web/components/runs/launch/runtime-picker";
import { resolveRuntimeChoice } from "@web/lib/runtimes";
import { useState } from "react";

export interface LaunchRunPopoverProps {
  issueId: string;
  onLaunched: (run: RunContract) => void;
  triggerLabel?: string;
}

/**
 * Launch-run action for the issue workspace: the runtime comes from the
 * daemon's readiness list, the launched run is tied to the issue via
 * `issue_id`, and the workspace stays put to follow it live.
 */
export function LaunchRunPopover({
  issueId,
  onLaunched,
  triggerLabel = "Launch run",
}: LaunchRunPopoverProps) {
  const [open, setOpen] = useState(false);
  const [runtimeChoice, setRuntimeChoice] = useState<string | null>(null);
  const runtimes = useRuntimes();
  const startRun = useStartRun();
  const descriptors = runtimes.data ?? [];
  const runtime = resolveRuntimeChoice(descriptors, runtimeChoice);

  async function launch() {
    if (runtime === null) return;
    try {
      const run = await startRun.mutateAsync({ issue_id: issueId, runtime });
      toast.success("Run started");
      setOpen(false);
      onLaunched(run);
    } catch (error) {
      toast.error(startRunErrorMessage(error));
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="primary" size="sm">
            <Icon name="play" aria-hidden />
            {triggerLabel}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold text-text-secondary">Launch a run</span>
          <RuntimePicker
            descriptors={descriptors}
            value={runtime}
            onValueChange={setRuntimeChoice}
            isPending={runtimes.isPending}
            isError={runtimes.isError}
            isSuccess={runtimes.isSuccess}
            onRetry={() => void runtimes.refetch()}
          />
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            loading={startRun.isPending}
            disabled={runtime === null || startRun.isPending}
            onClick={() => void launch()}
          >
            <Icon name="play" aria-hidden />
            Launch on this issue
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
