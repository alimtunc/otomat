import type { RegisterRepositoryRequest } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import {
  registerRepositoryErrorMessage,
  useRegisterRepository,
} from "@web/api/repositories/mutations";
import { SavedNotice } from "@web/components/settings/saved-notice";
import { desktopBridge, remoteHostAlias } from "@web/lib/desktop-bridge";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { useState } from "react";

export interface RegisterRepositoryFormProps {
  projectId?: string;
}

export function RegisterRepositoryForm({ projectId }: RegisterRepositoryFormProps) {
  const register = useRegisterRepository();
  const bridge = desktopBridge();
  const remoteAlias = remoteHostAlias();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { path: "" },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        const request: RegisterRepositoryRequest = { path: value.path.trim() };
        if (projectId !== undefined) request.project_id = projectId;
        await register.mutateAsync(request);
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
      if (picked === null) return;
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
        validators={{
          onChange: requiredTrimmed(
            remoteAlias === null
              ? "Enter the absolute path of a local repository."
              : `Enter the absolute path of a repository on ${remoteAlias}.`,
          ),
        }}
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
                    placeholder={
                      remoteAlias === null
                        ? "/absolute/path/to/repository"
                        : `/absolute/path/on/${remoteAlias}`
                    }
                    aria-label="Repository path"
                    spellCheck={false}
                  />
                </FieldControl>
              </div>
              {bridge === null || remoteAlias !== null ? null : (
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
      <form.Subscribe selector={(state) => state.isDefaultValue}>
        {(isDefault) =>
          register.isSuccess && isDefault && submitError === null ? (
            <SavedNotice>Registered {register.data.project.name}</SavedNotice>
          ) : null
        }
      </form.Subscribe>
      {submitError === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {submitError}
        </p>
      )}
    </form>
  );
}
