import { Button, Field, FieldControl, FieldLabel, Input, toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import {
  registerRepositoryErrorMessage,
  useRegisterRepository,
} from "@web/api/repositories/mutations";
import { getFolderPicker } from "@web/lib/folder-picker";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { useState } from "react";

export function RegisterRepositoryForm() {
  const register = useRegisterRepository();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const picker = getFolderPicker();

  const form = useForm({
    defaultValues: { path: "" },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        const registered = await register.mutateAsync({ path: value.path.trim() });
        toast.success(`Registered ${registered.project.name}`);
        form.reset();
      } catch (error) {
        setSubmitError(registerRepositoryErrorMessage(error));
      }
    },
  });

  async function browse() {
    const picked = await picker?.pickFolder();
    if (picked) form.setFieldValue("path", picked);
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="path"
        validators={{ onChange: requiredTrimmed("Enter the absolute path of a local repository.") }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldLabel>Repository path</FieldLabel>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <FieldControl>
                  <Input
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="/absolute/path/to/repository"
                    aria-label="Repository path"
                    spellCheck={false}
                  />
                </FieldControl>
              </div>
              {picker ? (
                <Button type="button" variant="outline" size="sm" onClick={() => void browse()}>
                  Browse…
                </Button>
              ) : null}
              <form.Subscribe selector={(state) => state.values.path}>
                {(path) => (
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={register.isPending}
                    disabled={path.trim().length === 0 || register.isPending}
                  >
                    Register
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </Field>
        )}
      </form.Field>
      {submitError === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {submitError}
        </p>
      )}
    </form>
  );
}
