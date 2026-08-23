import type { RunContract } from "@otomat/domain";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  Icon,
  SegmentedControl,
  SegmentedItem,
} from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { AgentIssueForm } from "@web/components/issues/agent-issue-form";
import { ManualIssueForm } from "@web/components/issues/manual-issue-form";
import { WorkflowLaunchForm } from "@web/components/issues/workflow/form";
import { LaunchTargetGate } from "@web/components/runs/launch/launch-target-gate";
import { EMPTY_EXECUTION_SELECTION, type ExecutionSelection } from "@web/lib/execution/selection";
import { useState } from "react";

const NEW_ISSUE_MODES = ["agent", "workflow", "manual"] as const;
type NewIssueMode = (typeof NEW_ISSUE_MODES)[number];

function isNewIssueMode(value: string): value is NewIssueMode {
  return NEW_ISSUE_MODES.some((mode) => mode === value);
}

export interface NewIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectName?: string;
}

export function NewIssueDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: NewIssueDialogProps) {
  const [mode, setMode] = useState<NewIssueMode>("agent");
  const [execution, setExecution] = useState<ExecutionSelection>(EMPTY_EXECUTION_SELECTION);
  const navigate = useNavigate();
  const close = () => onOpenChange(false);

  function launched(run: RunContract) {
    close();
    navigate({ to: "/runs/$runId", params: { runId: run.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="New issue">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.75 text-sm text-text-secondary">
              {projectName ? (
                <>
                  <b className="font-semibold text-foreground">{projectName}</b>
                  <Icon
                    name="chevron-down"
                    aria-hidden
                    className="h-3.25 w-3.25 -rotate-90 text-text-tertiary"
                  />
                </>
              ) : null}
              <span>New issue</span>
            </div>
            <SegmentedControl
              type="single"
              value={mode}
              onValueChange={(value) => {
                if (isNewIssueMode(value)) setMode(value);
              }}
              aria-label="Issue creation mode"
            >
              <SegmentedItem value="agent">With agent</SegmentedItem>
              <SegmentedItem value="workflow">Workflow</SegmentedItem>
              <SegmentedItem value="manual">Manual</SegmentedItem>
            </SegmentedControl>
          </div>
        </DialogHeader>
        {mode === "agent" || mode === "workflow" ? (
          <LaunchTargetGate projectId={projectId}>
            {(target) =>
              mode === "agent" ? (
                <AgentIssueForm
                  target={target}
                  execution={execution}
                  onExecutionChange={setExecution}
                  onLaunched={launched}
                  onCancel={close}
                />
              ) : (
                <WorkflowLaunchForm
                  target={{ kind: "project", projectId: target.repository.project_id }}
                  worktreeTarget={target}
                  execution={execution}
                  onExecutionChange={setExecution}
                  onLaunched={launched}
                  onCancel={close}
                />
              )
            }
          </LaunchTargetGate>
        ) : null}
        {mode === "manual" ? (
          <ManualIssueForm projectId={projectId} onCreated={close} onCancel={close} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
