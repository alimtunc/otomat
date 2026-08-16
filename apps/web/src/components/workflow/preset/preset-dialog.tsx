import type { WorkflowPresetContract } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
} from "@otomat/ui";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { WorkflowPlanEditor } from "@web/components/workflow/plan-editor";
import { PresetIdentityFields } from "@web/components/workflow/preset/identity-fields";
import { usePresetForm } from "@web/components/workflow/preset/use-preset-form";
import { EMPTY_EXECUTION_SELECTION } from "@web/lib/execution/selection";

export interface WorkflowPresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The preset being edited; null composes a new, empty one. */
  preset: WorkflowPresetContract | null;
  projectId: string | undefined;
}

export function WorkflowPresetDialog({
  open,
  onOpenChange,
  preset,
  projectId,
}: WorkflowPresetDialogProps) {
  const agents = useLaunchAgentChoice(null);
  const presetForm = usePresetForm({
    preset,
    initialSteps: [],
    projectId,
    onSaved: () => onOpenChange(false),
  });
  const title = preset === null ? "New workflow preset" : `Edit ${preset.name}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label={title}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex max-h-[62vh] flex-col gap-3 overflow-y-auto">
          <PresetIdentityFields form={presetForm.form} projectId={projectId} />
          {agents.isError ? (
            <EmptyState
              variant="compact"
              tone="error"
              icon="alert-triangle"
              title="Couldn’t load agents"
              description="Agent names and options below stay incomplete until the daemon answers."
              action={
                <Button variant="outline" size="xs" onClick={agents.onRetry}>
                  Retry
                </Button>
              }
            />
          ) : null}
          <WorkflowPlanEditor
            plan={presetForm.plan}
            execution={{ agents, inherited: EMPTY_EXECUTION_SELECTION }}
            contextScope={null}
            error={null}
          />
          {presetForm.refusal === null ? null : (
            <p role="alert" className="text-xs text-danger">
              {presetForm.refusal}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={presetForm.isPending}
            disabled={!presetForm.canSave || presetForm.isPending}
            onClick={() => void presetForm.form.handleSubmit()}
          >
            {preset === null ? "Create preset" : "Save preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
