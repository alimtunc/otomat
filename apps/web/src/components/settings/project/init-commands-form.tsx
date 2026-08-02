import type { RepositoryContract } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel, Textarea, toast } from "@otomat/ui";
import { useUpdateRepository } from "@web/api/repositories/mutations";
import { useState } from "react";

function parseCommands(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function InitCommandsForm({ repository }: { repository: RepositoryContract }) {
  const update = useUpdateRepository();
  const [value, setValue] = useState(repository.init_commands.join("\n"));
  const dirty = parseCommands(value).join("\n") !== repository.init_commands.join("\n");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate(
          { repositoryId: repository.id, request: { init_commands: parseCommands(value) } },
          {
            onSuccess: () => toast.success("Worktree init commands saved"),
            onError: () => toast.error("Could not save the init commands."),
          },
        );
      }}
    >
      <Field hint="One shell command per line, run in the run's fresh worktree before the agent starts (compete candidate worktrees skip them). A failing command fails the run.">
        <FieldLabel>Worktree init commands</FieldLabel>
        <FieldControl>
          <Textarea
            rows={4}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={"pnpm install\npnpm build"}
          />
        </FieldControl>
      </Field>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!dirty}
          loading={update.isPending}
        >
          Save init commands
        </Button>
      </div>
    </form>
  );
}
