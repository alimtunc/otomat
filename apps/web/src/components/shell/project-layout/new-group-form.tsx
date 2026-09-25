import { Button, Field, FieldControl, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { fieldErrorProps, hasText, requiredTrimmed } from "@web/lib/form";

export function NewGroupForm({ onCreate }: { onCreate: (name: string) => void }) {
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value, formApi }) => {
      onCreate(value.name.trim());
      formApi.reset();
    },
  });

  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name" validators={{ onChange: requiredTrimmed("Name the group.") }}>
        {(field) => (
          <Field className="min-w-0 flex-1" {...fieldErrorProps(field.state.meta)}>
            <FieldControl>
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="New group name"
                aria-label="New group name"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => hasText(state.values.name)}>
        {(filled) => (
          <Button size="sm" type="submit" disabled={!filled}>
            Add group
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
