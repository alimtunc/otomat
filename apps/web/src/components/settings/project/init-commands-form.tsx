import type { RepositoryContract } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel, Textarea } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useUpdateRepository } from "@web/api/repositories/mutations";
import { SavedNotice } from "@web/components/settings/saved-notice";

function parseCommands(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function InitCommandsForm({ repository }: { repository: RepositoryContract }) {
  const update = useUpdateRepository();
  const saved = repository.init_commands.join("\n");

  const form = useForm({
    defaultValues: { commands: saved },
    onSubmit: ({ value }) => {
      update.mutate({
        repositoryId: repository.id,
        request: { init_commands: parseCommands(value.commands) },
      });
    },
  });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="commands">
        {(field) => (
          <Field hint="One shell command per line, run in every fresh worktree — the run's and each compete candidate's — before the agent starts. A failing command fails the run, or just that candidate.">
            <FieldLabel>Worktree init commands</FieldLabel>
            <FieldControl>
              <Textarea
                rows={4}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={"pnpm install\npnpm build"}
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <div className="flex items-center justify-end gap-2.5">
        {update.isError ? (
          <p role="alert" className="text-xs text-danger">
            Could not save the init commands.
          </p>
        ) : null}
        <form.Subscribe selector={(state) => parseCommands(state.values.commands).join("\n")}>
          {(edited) => (
            <>
              {update.isSuccess && edited === saved ? (
                <SavedNotice>Worktree init commands saved</SavedNotice>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={edited === saved}
                loading={update.isPending}
              >
                Save init commands
              </Button>
            </>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
