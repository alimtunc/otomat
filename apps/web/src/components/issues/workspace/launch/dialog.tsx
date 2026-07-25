import type { IssueContract, RunContract } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  Icon,
  SegmentedControl,
  SegmentedItem,
} from "@otomat/ui";
import { SingleRunLaunchForm } from "@web/components/issues/workspace/launch/single-run-form";
import { IssueWorkflowForm } from "@web/components/issues/workspace/launch/workflow-form";
import { issueShortId } from "@web/lib/ids";
import { useState } from "react";

const LAUNCH_MODES = ["single", "workflow"] as const;
type LaunchMode = (typeof LAUNCH_MODES)[number];

function isLaunchMode(value: string): value is LaunchMode {
  return (LAUNCH_MODES as readonly string[]).includes(value);
}

export interface LaunchRunDialogProps {
  issue: IssueContract;
  onLaunched: (run: RunContract) => void;
  triggerLabel?: string;
}

/**
 * The one surface that launches work on an existing issue: a single agent turn
 * or a multi-step workflow, both frozen into the same `plan` contract and both
 * followed in place on the issue workspace.
 */
export function LaunchRunDialog({
  issue,
  onLaunched,
  triggerLabel = "Launch run",
}: LaunchRunDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LaunchMode>("single");
  const [agentChoice, setAgentChoice] = useState<string | null>(null);

  /** Closing discards the composed draft with the forms, so the mode it was composed in goes with it. */
  function openChange(next: boolean) {
    setOpen(next);
    if (!next) setMode("single");
  }

  function launched(run: RunContract) {
    openChange(false);
    onLaunched(run);
  }

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger
        render={
          <Button variant="primary" size="sm">
            <Icon name="play" aria-hidden />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent aria-label="Launch on this issue">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.75 text-sm text-text-secondary">
              <b className="font-semibold text-foreground">{issueShortId(issue)}</b>
              <Icon
                name="chevron-down"
                aria-hidden
                className="h-3.25 w-3.25 -rotate-90 text-text-tertiary"
              />
              <span>Launch</span>
            </div>
            <SegmentedControl
              type="single"
              value={mode}
              onValueChange={(value) => {
                if (isLaunchMode(value)) setMode(value);
              }}
              aria-label="Launch mode"
            >
              <SegmentedItem value="single">Single run</SegmentedItem>
              <SegmentedItem value="workflow">Workflow</SegmentedItem>
            </SegmentedControl>
          </div>
        </DialogHeader>
        {mode === "single" ? (
          <SingleRunLaunchForm
            issue={issue}
            agentChoice={agentChoice}
            onAgentChoice={setAgentChoice}
            onLaunched={launched}
            onCancel={() => openChange(false)}
          />
        ) : (
          <IssueWorkflowForm
            issueId={issue.id}
            agentChoice={agentChoice}
            onAgentChoice={setAgentChoice}
            onLaunched={launched}
            onCancel={() => openChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
