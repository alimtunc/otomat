import type { CheckoutTarget, CreateWorktreeEntryRequest, WorktreeFileEntry } from "@otomat/domain";
import { Field, FieldControl, FileIcon, Icon, Input, Spinner } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useCreateEntry } from "@web/api/files/mutations";
import { entryNameError } from "@web/components/files/entry-name";
import { joinPath } from "@web/components/files/tree/path";
import { fieldErrorProps } from "@web/lib/form";
import { worktreeFileMessage, worktreeFileRefusal } from "@web/lib/run/file-refusal";

export interface CreateEntryRowProps {
  target: CheckoutTarget;
  kind: CreateWorktreeEntryRequest["kind"];
  directory: string;
  entries: readonly WorktreeFileEntry[];
  onCreated: (entry: WorktreeFileEntry) => void;
  onExisting: (path: string) => void;
  onCancel: () => void;
}

export function CreateEntryRow({
  target,
  kind,
  directory,
  entries,
  onCreated,
  onExisting,
  onCancel,
}: CreateEntryRowProps) {
  const create = useCreateEntry(target);
  const label = kind === "file" ? "file" : "folder";
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value }) => {
      if (create.isPending) return;
      const path = joinPath(directory, value.name.trim());
      create.mutate(
        { path, kind },
        {
          onSuccess: onCreated,
          onError: (error) => {
            if (kind === "file" && worktreeFileRefusal(error) === "path_exists") onExisting(path);
          },
        },
      );
    },
  });
  return (
    <form
      aria-label={`Create ${label} in ${directory || "project root"}`}
      aria-busy={create.isPending}
      className="py-0.5 pr-2"
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
          onChange: ({ value }) => entryNameError(value.trim(), directory, entries, label),
        }}
      >
        {(field) => {
          const icon =
            kind === "directory" ? (
              <Icon name="folder" className="size-3.5 text-text-tertiary" />
            ) : (
              <FileIcon path={field.state.value} />
            );
          const validation = fieldErrorProps(field.state.meta);
          const error =
            validation.error ??
            (create.error === null
              ? undefined
              : worktreeFileMessage(create.error, `Could not create the ${label}.`));
          return (
            <div className="flex items-start gap-1.5">
              <span className="flex h-7 shrink-0 items-center" aria-hidden>
                {create.isPending ? <Spinner size={14} /> : icon}
              </span>
              <Field invalid={error !== undefined} error={error} className="min-w-0 flex-1 gap-0">
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
