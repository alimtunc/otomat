import type { CheckoutTarget, CreateWorktreeEntryRequest, WorktreeFileEntry } from "@otomat/domain";
import { Field, FieldControl, FileIcon, Icon, Input, Spinner } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useCreateEntry } from "@web/api/files/use-create-entry";
import { INDENT_REM, ROW_PADDING_REM } from "@web/components/files/tree/indent";
import { worktreeFileMessage } from "@web/lib/run/file-refusal";

export interface CreateEntryRowProps {
  target: CheckoutTarget;
  kind: CreateWorktreeEntryRequest["kind"];
  directory: string;
  entries: readonly WorktreeFileEntry[];
  depth: number;
  onCreated: (entry: WorktreeFileEntry) => void;
  onCancel: () => void;
}

export function CreateEntryRow({
  target,
  kind,
  directory,
  entries,
  depth,
  onCreated,
  onCancel,
}: CreateEntryRowProps) {
  const create = useCreateEntry(target);
  const label = kind === "file" ? "file" : "folder";
  const prefix = directory === "" ? "" : `${directory}/`;
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value }) => {
      if (!create.isPending) {
        create.mutate({ path: `${prefix}${value.name.trim()}`, kind }, { onSuccess: onCreated });
      }
    },
  });
  return (
    <form
      aria-label={`Create ${label} in ${directory || "project root"}`}
      aria-busy={create.isPending}
      className="py-0.5 pr-2"
      style={{ paddingLeft: `${ROW_PADDING_REM + depth * INDENT_REM}rem` }}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        if (!create.isPending) onCancel();
      }}
    >
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) => {
            const name = value.trim();
            if (name === "") return `Enter a ${label} name.`;
            if (name.toLowerCase() === ".git") {
              return "The name .git is reserved by Git. Names like .gitignore are allowed.";
            }
            if (/[\\/\0]/.test(name) || name === "." || name === "..")
              return "Choose a name without slashes, other than . or ...";
            const path = `${prefix}${name}`;
            if (entries.some((entry) => entry.path === path || entry.path.startsWith(`${path}/`))) {
              return `A file or folder named ${name} already exists here. Choose a different name.`;
            }
            return undefined;
          },
        }}
      >
        {(field) => {
          const icon =
            kind === "directory" ? (
              <Icon name="folder" className="size-3.5 text-text-tertiary" />
            ) : (
              <FileIcon path={field.state.value} />
            );
          const error =
            field.state.meta.errors[0] ??
            (create.error === null
              ? undefined
              : worktreeFileMessage(create.error, `Could not create the ${label}.`));
          return (
            <div className="flex items-start gap-1.5">
              <span className="flex h-7 shrink-0 items-center" aria-hidden>
                {create.isPending ? <Spinner size={14} /> : icon}
              </span>
              <Field
                invalid={error !== undefined}
                error={error}
                className="min-w-0 flex-1 gap-0 [&_[role=alert]]:border [&_[role=alert]]:border-danger [&_[role=alert]]:bg-danger/10 [&_[role=alert]]:px-2 [&_[role=alert]]:py-1"
              >
                <FieldControl>
                  <Input
                    aria-label={`New ${label} name`}
                    title="Enter to create, Escape to cancel"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      create.reset();
                      field.handleChange(event.target.value);
                    }}
                    disabled={create.isPending}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    className="h-7 rounded-none px-1 text-xs"
                  />
                </FieldControl>
              </Field>
            </div>
          );
        }}
      </form.Field>
    </form>
  );
}
