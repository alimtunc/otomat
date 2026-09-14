import type { RunContract } from "@otomat/domain";
import { DialogHeader, Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { AgentIssueForm } from "@web/components/issues/agent-issue-form";
import { ManualIssueForm } from "@web/components/issues/manual-issue-form";
import { WorkflowLaunchForm } from "@web/components/issues/workflow/form";
import { LaunchTargetGate } from "@web/components/runs/launch/launch-target-gate";
import { EMPTY_EXECUTION_SELECTION, type ExecutionSelection } from "@web/lib/execution/selection";
import { useState, type ReactNode } from "react";

export interface IssueCreationContentProps {
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectName?: string;
}

const NEW_ISSUE_MODES = [
  { value: "agent", label: "With agent" },
  { value: "workflow", label: "Workflow" },
  { value: "manual", label: "Manual" },
] as const;
type NewIssueMode = (typeof NEW_ISSUE_MODES)[number]["value"];

function isNewIssueMode(value: string): value is NewIssueMode {
  return NEW_ISSUE_MODES.some((mode) => mode.value === value);
}

function ModePanel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div hidden={!active} inert={!active} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}

export function IssueCreationContent({
  onOpenChange,
  projectId,
  projectName,
}: IssueCreationContentProps) {
  const [mode, setMode] = useState<NewIssueMode>("agent");
  const [execution, setExecution] = useState<ExecutionSelection>(EMPTY_EXECUTION_SELECTION);
  const [drafts, setDrafts] = useState({ agent: false, workflow: false, manual: false });
  const navigate = useNavigate();
  const close = () => onOpenChange(false);

  const launched = (run: RunContract) => {
    close();
    navigate({ to: "/runs/$runId", params: { runId: run.id } });
  };

  return (
    <>
      <DialogHeader className="shrink-0">
        <div className="flex flex-wrap items-center gap-3 pr-5">
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
            {NEW_ISSUE_MODES.map((option) => (
              <SegmentedItem key={option.value} value={option.value}>
                {option.label}
                {drafts[option.value] ? (
                  <span
                    aria-label="Draft kept"
                    className="ml-1 size-1.25 rounded-full bg-warning"
                  />
                ) : null}
              </SegmentedItem>
            ))}
          </SegmentedControl>
        </div>
      </DialogHeader>
      <ModePanel active={mode !== "manual"}>
        <LaunchTargetGate projectId={projectId}>
          {(target) => (
            <>
              <ModePanel active={mode === "agent"}>
                <AgentIssueForm
                  target={target}
                  execution={execution}
                  onExecutionChange={setExecution}
                  onLaunched={launched}
                  onCancel={close}
                  onDraftChange={(agent) => setDrafts((current) => ({ ...current, agent }))}
                />
              </ModePanel>
              <ModePanel active={mode === "workflow"}>
                <WorkflowLaunchForm
                  target={{ kind: "project", projectId: target.repository.project_id }}
                  worktreeTarget={target}
                  execution={execution}
                  onExecutionChange={setExecution}
                  onLaunched={launched}
                  onCancel={close}
                  autoFocus={false}
                  onDraftChange={(workflow) => setDrafts((current) => ({ ...current, workflow }))}
                />
              </ModePanel>
            </>
          )}
        </LaunchTargetGate>
      </ModePanel>
      <ModePanel active={mode === "manual"}>
        <ManualIssueForm
          projectId={projectId}
          onCreated={close}
          onCancel={close}
          onDraftChange={(manual) => setDrafts((current) => ({ ...current, manual }))}
        />
      </ModePanel>
    </>
  );
}
