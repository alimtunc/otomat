import { Button, Field, FieldControl, FieldLabel, Input, toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import {
  registerRepositoryErrorMessage,
  useRegisterRepository,
} from "@web/api/repositories/mutations";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { useState } from "react";

export function RegisterRepositoryForm() {
  const register = useRegisterRepository();
  const bridge = desktopBridge();
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  async function browseForPath(): Promise<void> {
    if (bridge === null) return;
    try {
      const picked = await bridge.pickDirectory();
      if (picked === null) return; // canceled: create nothing, leave the typed path untouched
      setSubmitError(null);
      form.setFieldValue("path", picked);
    } catch {
      setSubmitError("Could not open the folder picker.");
    }
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
                    onChange={(event) => {
                      setSubmitError(null);
                      field.handleChange(event.target.value);
                    }}
                    placeholder="/absolute/path/to/repository"
                    aria-label="Repository path"
                    spellCheck={false}
                  />
                </FieldControl>
              </div>
              {bridge === null ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={register.isPending}
                  onClick={() => void browseForPath()}
                >
                  Browse…
                </Button>
              )}
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
