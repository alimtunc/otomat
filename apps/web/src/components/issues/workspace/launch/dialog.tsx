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
import { WorkflowLaunchForm } from "@web/components/issues/workflow/form";
import { SingleRunLaunchForm } from "@web/components/issues/workspace/launch/single-run-form";
import { LaunchTargetGate } from "@web/components/runs/launch/launch-target-gate";
import { AppendStepForm } from "@web/components/runs/steps/append-step-form";
import { EMPTY_EXECUTION_SELECTION, type ExecutionSelection } from "@web/lib/execution/selection";
import { issueShortId } from "@web/lib/ids";
import { useState, type ComponentPropsWithoutRef } from "react";

const LAUNCH_MODES = ["single", "workflow"] as const;
type LaunchMode = (typeof LAUNCH_MODES)[number];

function isLaunchMode(value: string): value is LaunchMode {
  return (LAUNCH_MODES as readonly string[]).includes(value);
}

export interface LaunchRunDialogProps {
  /** Undefined while the issue is still loading: the trigger stays on screen, disabled, instead of vanishing. */
  issue: IssueContract | undefined;
  /** The run the surface should follow — a fresh one, or the workspace run the step joined. */
  onLaunched: (run: RunContract) => void;
}

type LaunchTriggerProps = ComponentPropsWithoutRef<typeof Button> & { continuing?: boolean };

function LaunchTrigger({ continuing = false, ...props }: LaunchTriggerProps) {
  return (
    <Button variant="primary" size="sm" {...props}>
      <Icon name={continuing ? "plus" : "play"} aria-hidden />
      {continuing ? "Add step" : "Launch run"}
    </Button>
  );
}

/**
 * The one surface that starts work on an issue. While the issue's workspace is
 * open it can only grow: the action appends a step to that run's plan, in its
 * branch and worktree. A closed workspace launches a fresh cycle instead — a
 * single agent turn or a workflow, both frozen into the same `plan` contract.
 */
export function LaunchRunDialog({ issue, onLaunched }: LaunchRunDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LaunchMode>("single");
  const [execution, setExecution] = useState<ExecutionSelection>(EMPTY_EXECUTION_SELECTION);

  /** Closing discards the composed draft with the forms, so the mode it was composed in goes with it. */
  function openChange(next: boolean) {
    setOpen(next);
    if (!next) setMode("single");
  }

  function launched(run: RunContract) {
    openChange(false);
    onLaunched(run);
  }

  if (issue === undefined)
    return <LaunchTrigger disabled title="Available once this issue has loaded" />;

  const workspace = issue.workspace;
  const continuing = workspace.state === "open";

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger render={<LaunchTrigger continuing={continuing} />} />
      <DialogContent aria-label={continuing ? "Add a step to this issue" : "Launch on this issue"}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.75 text-sm text-text-secondary">
              <b className="font-semibold text-foreground">{issueShortId(issue)}</b>
              <Icon
                name="chevron-down"
                aria-hidden
                className="h-3.25 w-3.25 -rotate-90 text-text-tertiary"
              />
              <span>{continuing ? "Add step" : "Launch"}</span>
            </div>
            {continuing ? null : (
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
            )}
          </div>
        </DialogHeader>
        {workspace.state === "open" ? (
          <AppendStepForm
            workspace={workspace}
            execution={execution}
            onExecutionChange={setExecution}
            onAppended={launched}
            onCancel={() => openChange(false)}
          />
        ) : (
          <LaunchTargetGate projectId={issue.project_id} issue={issue}>
            {(target) =>
              mode === "single" ? (
                <SingleRunLaunchForm
                  issue={issue}
                  target={target}
                  execution={execution}
                  onExecutionChange={setExecution}
                  onLaunched={launched}
                  onCancel={() => openChange(false)}
                />
              ) : (
                <WorkflowLaunchForm
                  target={{ kind: "issue", issueId: issue.id }}
                  worktreeTarget={target}
                  execution={execution}
                  onExecutionChange={setExecution}
                  onLaunched={launched}
                  onCancel={() => openChange(false)}
                />
              )
            }
          </LaunchTargetGate>
        )}
      </DialogContent>
    </Dialog>
  );
}
