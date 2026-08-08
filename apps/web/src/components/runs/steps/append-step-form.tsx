import type { IssueWorkspace, ModelSelection, RunContract } from "@otomat/domain";
import {
  Button,
  DialogBody,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  Kbd,
  Textarea,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useAppendRunStep } from "@web/api/runs/mutations";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { LaunchAgentModelFields } from "@web/components/runs/launch/launch-agent-model-fields";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { WorkspaceReuseNote } from "@web/components/runs/steps/workspace-reuse-note";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";
import { isCompleteModelSelection } from "@web/lib/model-choice";

export interface AppendStepFormProps {
  workspace: Extract<IssueWorkspace, { state: "open" }>;
  agentChoice: string | null;
  onAgentChoice: (choice: string | null) => void;
  onAppended: (run: RunContract) => void;
  onCancel: () => void;
}

interface AppendStepValues {
  name: string;
  prompt: string;
  /** Model override for this step alone; undefined keeps the chosen agent's own model. */
  model: ModelSelection | undefined;
}

const APPEND_STEP_DEFAULT_VALUES: AppendStepValues = { name: "", prompt: "", model: undefined };

/** Adds one step to the issue's canonical run: its own name, prompt and explicitly chosen agent. */
export function AppendStepForm({
  workspace,
  agentChoice,
  onAgentChoice,
  onAppended,
  onCancel,
}: AppendStepFormProps) {
  const agents = useLaunchAgentChoice(agentChoice);
  const append = useAppendRunStep(workspace.run_id);
  const form = useForm({
    defaultValues: APPEND_STEP_DEFAULT_VALUES,
    onSubmit: ({ value }) => {
      if (agents.choice === null) return;
      append.mutate(
        {
          name: value.name.trim(),
          prompt: value.prompt.trim(),
          ...agentChoiceToRequest(agents.choice),
          model: value.model,
          depends_on: [],
        },
        {
          onSuccess: (run) => {
            form.reset();
            onAppended(run);
          },
        },
      );
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      onKeyDown={submitOnCmdEnter(() => void form.handleSubmit())}
    >
      <DialogBody className="flex flex-col gap-3">
        <WorkspaceReuseNote workspace={workspace} />
        <form.Field name="name" validators={{ onChange: requiredTrimmed("Name the step.") }}>
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Step name</FieldLabel>
              <FieldControl>
                <Input
                  autoFocus
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Address the failing test"
                  aria-label="Step name"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <form.Field
          name="prompt"
          validators={{ onChange: requiredTrimmed("Say what this step should do.") }}
        >
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Prompt</FieldLabel>
              <FieldControl>
                <Textarea
                  rows={5}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="What should this step do in the existing workspace?"
                  aria-label="Step prompt"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <form.Field name="model">
          {(field) => (
            <LaunchAgentModelFields
              agents={agents}
              model={field.state.value}
              onAgentChoice={onAgentChoice}
              onModelChange={field.handleChange}
            />
          )}
        </form.Field>
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe
            selector={(state) =>
              hasText(state.values.name) &&
              hasText(state.values.prompt) &&
              isCompleteModelSelection(state.values.model)
            }
          >
            {(filled) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={append.isPending}
                disabled={!(filled && agents.choice !== null && !append.isPending)}
              >
                Add step
                <Kbd tone="on-accent">⌘↵</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </form>
  );
}
