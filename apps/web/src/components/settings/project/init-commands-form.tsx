import type { RepositoryContract } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel, Textarea, toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useUpdateRepository } from "@web/api/repositories/mutations";

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
      update.mutate(
        {
          repositoryId: repository.id,
          request: { init_commands: parseCommands(value.commands) },
        },
        {
          onSuccess: () => toast.success("Worktree init commands saved"),
          onError: () => toast.error("Could not save the init commands."),
        },
      );
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
      <div className="flex justify-end">
        <form.Subscribe selector={(state) => parseCommands(state.values.commands).join("\n")}>
          {(edited) => (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={edited === saved}
              loading={update.isPending}
            >
              Save init commands
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
