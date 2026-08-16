import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";
import { PresetIdentityFields } from "@web/components/workflow/preset/identity-fields";
import { usePresetForm } from "@web/components/workflow/preset/use-preset-form";
import { workflowExecutableCount, type WorkflowNodeDraft } from "@web/lib/workflow-draft";

export interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The composition to store, exactly as it stands in the surface that opened this. */
  steps: WorkflowNodeDraft[];
  projectId: string | undefined;
}

const TITLE = "Save this workflow as a preset";

/** Names a composition and keeps it. The composition it was opened on is left untouched. */
export function SavePresetDialog({ open, onOpenChange, steps, projectId }: SavePresetDialogProps) {
  const presetForm = usePresetForm({
    preset: null,
    initialSteps: steps,
    projectId,
    onSaved: () => onOpenChange(false),
  });
  const executables = workflowExecutableCount(steps);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label={TITLE}>
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <PresetIdentityFields form={presetForm.form} projectId={projectId} />
          <p className="text-xs text-text-tertiary">
            {`Saves ${executables} agent turn${executables === 1 ? "" : "s"} with their dependencies, agents and static instructions. Attached issues and files stay with this launch.`}
          </p>
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
            Save preset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
