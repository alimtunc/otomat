import {
  FIX_REVIEW_COMMENTS_STEP_NAME,
  type ModelSelection,
  type RequestFixRequest,
} from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  Field,
  FieldControl,
  FieldLabel,
  Icon,
  Input,
} from "@otomat/ui";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { LaunchAgentModelFields } from "@web/components/runs/launch/launch-agent-model-fields";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import { hasText } from "@web/lib/form";
import { isCompleteModelSelection } from "@web/lib/model-choice";
import { useState } from "react";

export interface ReviewFixStepDialogProps {
  selection: ReviewSelection;
  /** True while the run cannot take a step; the trigger stays visible and explains itself. */
  disabled: boolean;
}

/** Turns the selected comments into an appended step, on an agent the user picks here rather than inherits. */
export function ReviewFixStepDialog({ selection, disabled }: ReviewFixStepDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(FIX_REVIEW_COMMENTS_STEP_NAME);
  const [agentChoice, setAgentChoice] = useState<string | null>(null);
  const [model, setModel] = useState<ModelSelection | undefined>(undefined);
  const agents = useLaunchAgentChoice(agentChoice);
  const canSubmit =
    hasText(name) &&
    agents.choice !== null &&
    isCompleteModelSelection(model) &&
    !selection.isFixPending;

  function submit(): void {
    if (!canSubmit || agents.choice === null) return;
    const request: RequestFixRequest = {
      comment_ids: [...selection.selectedIds],
      name: name.trim(),
      ...agentChoiceToRequest(agents.choice),
      model,
    };
    selection.requestFix(request, () => setOpen(false));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="primary" size="sm" disabled={disabled}>
            <Icon name="wand-2" aria-hidden />
            Fix selected comments with AI
          </Button>
        }
      />
      <DialogContent aria-label="Fix the selected review comments">
        <DialogHeader>
          <span className="text-sm text-text-secondary">
            {selection.selectedIds.size === 1
              ? "1 comment becomes a new step"
              : `${selection.selectedIds.size} comments become a new step`}
          </span>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-text-tertiary">
            The step is appended to this issue’s plan and runs in its workspace. Each selected
            comment, its pinned hunk, the current file and the current diff sha are frozen as its
            context.
          </p>
          <Field>
            <FieldLabel>Step name</FieldLabel>
            <FieldControl>
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label="Fix step name"
              />
            </FieldControl>
          </Field>
          <LaunchAgentModelFields
            agents={agents}
            model={model}
            onAgentChoice={setAgentChoice}
            onModelChange={setModel}
            modelAriaLabel="Fix step model"
          />
        </DialogBody>
        <IssueFormFooter
          onCancel={() => setOpen(false)}
          submit={
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={selection.isFixPending}
              disabled={!canSubmit}
              onClick={submit}
            >
              Add fix step
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
