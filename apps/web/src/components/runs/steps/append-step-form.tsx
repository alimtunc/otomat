import type { IssueWorkspace, RunContract } from "@otomat/domain";
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
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { WorkspaceReuseNote } from "@web/components/runs/steps/workspace-reuse-note";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";

export interface AppendStepFormProps {
  workspace: Extract<IssueWorkspace, { state: "open" }>;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onAppended: (run: RunContract) => void;
  onCancel: () => void;
}

export function AppendStepForm({
  workspace,
  execution,
  onExecutionChange,
  onAppended,
  onCancel,
}: AppendStepFormProps) {
  const launchExecution = useLaunchExecution(execution);
  const append = useAppendRunStep(workspace.run_id);
  const form = useForm({
    defaultValues: { name: "", prompt: "" },
    onSubmit: ({ value }) => {
      if (!launchExecution.canLaunch) return;
      append.mutate(
        {
          name: value.name.trim(),
          prompt: value.prompt.trim(),
          ...launchExecution.request,
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
        <LaunchExecutionPicker
          execution={launchExecution}
          onChange={onExecutionChange}
          label="Appended step"
        />
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe
            selector={(state) => hasText(state.values.name) && hasText(state.values.prompt)}
          >
            {(filled) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={append.isPending}
                disabled={!(filled && launchExecution.canLaunch && !append.isPending)}
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
