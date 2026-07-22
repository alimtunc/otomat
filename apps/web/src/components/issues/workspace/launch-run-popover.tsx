import type { RunContract } from "@otomat/domain";
import { Button, Icon, Popover, PopoverContent, PopoverTrigger, toast } from "@otomat/ui";
import { startRunErrorMessage, useStartRun } from "@web/api/runs/mutations";
import { LaunchAgentPicker } from "@web/components/runs/launch/launch-agent-picker";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import { useState } from "react";

export interface LaunchRunPopoverProps {
  issueId: string;
  onLaunched: (run: RunContract) => void;
  triggerLabel?: string;
}

/** Launch-run action that stays on the issue workspace (not the old navigate-away flow) so the launched run can be followed live. */
export function LaunchRunPopover({
  issueId,
  onLaunched,
  triggerLabel = "Launch run",
}: LaunchRunPopoverProps) {
  const [open, setOpen] = useState(false);
  const [agentChoice, setAgentChoice] = useState<string | null>(null);
  const agents = useLaunchAgentChoice(agentChoice);
  const startRun = useStartRun();
  const choice = agents.choice;

  async function launch() {
    if (choice === null) return;
    try {
      const run = await startRun.mutateAsync({
        issue_id: issueId,
        ...agentChoiceToRequest(choice),
      });
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
          <LaunchAgentPicker
            descriptors={agents.descriptors}
            profiles={agents.profiles}
            value={choice}
            onValueChange={setAgentChoice}
            isPending={agents.isPending}
            isError={agents.isError}
            isSuccess={agents.isSuccess}
            onRetry={agents.onRetry}
          />
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            loading={startRun.isPending}
            disabled={choice === null || startRun.isPending}
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
