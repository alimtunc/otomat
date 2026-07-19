import {
  Dialog,
  DialogContent,
  DialogHeader,
  Icon,
  SegmentedControl,
  SegmentedItem,
} from "@otomat/ui";
import { AgentIssueForm } from "@web/components/issues/agent-issue-form";
import { ManualIssueForm } from "@web/components/issues/manual-issue-form";
import { WorkflowIssueForm } from "@web/components/issues/workflow-issue-form";
import { useState } from "react";

const NEW_ISSUE_MODES = ["agent", "workflow", "manual"] as const;
type NewIssueMode = (typeof NEW_ISSUE_MODES)[number];

function isNewIssueMode(value: string): value is NewIssueMode {
  return (NEW_ISSUE_MODES as readonly string[]).includes(value);
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
  const [runtimeChoice, setRuntimeChoice] = useState<string | null>(null);
  const close = () => onOpenChange(false);

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
        {mode === "agent" ? (
          <AgentIssueForm
            projectId={projectId}
            runtimeChoice={runtimeChoice}
            onRuntimeChoice={setRuntimeChoice}
            onLaunched={close}
            onCancel={close}
          />
        ) : null}
        {mode === "workflow" ? (
          <WorkflowIssueForm
            projectId={projectId}
            runtimeChoice={runtimeChoice}
            onRuntimeChoice={setRuntimeChoice}
            onLaunched={close}
            onCancel={close}
          />
        ) : null}
        {mode === "manual" ? (
          <ManualIssueForm projectId={projectId} onCreated={close} onCancel={close} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
