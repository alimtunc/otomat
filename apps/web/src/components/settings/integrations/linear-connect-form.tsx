import { Button, Field, FieldControl, FieldLabel, Input, toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { linearErrorMessage, useConnectLinear } from "@web/api/linear/mutations";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { useState } from "react";

/**
 * Submits a Personal API key. The value is held in component state only for the
 * length of the submit and is cleared straight after — it is never written to
 * localStorage, a query cache, or a URL.
 */
export function LinearConnectForm() {
  const connect = useConnectLinear();
  const persists = desktopBridge() !== null;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { apiKey: "" },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        await connect.mutateAsync(value.apiKey.trim());
        form.reset();
        toast.success("Connected to Linear");
      } catch (error) {
        setSubmitError(linearErrorMessage(error));
      }
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
      <form.Field
        name="apiKey"
        validators={{ onChange: requiredTrimmed("Paste a Linear Personal API key.") }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldLabel>Personal API key</FieldLabel>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <FieldControl>
                  <Input
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      setSubmitError(null);
                      field.handleChange(event.target.value);
                    }}
                    placeholder="lin_api_…"
                    aria-label="Linear Personal API key"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </FieldControl>
              </div>
              <form.Subscribe selector={(state) => state.values.apiKey}>
                {(apiKey) => (
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={connect.isPending}
                    disabled={apiKey.trim().length === 0 || connect.isPending}
                  >
                    Connect
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </Field>
        )}
      </form.Field>
      <p className="text-xs text-text-tertiary">
        {persists
          ? "Stored encrypted on this device and held in daemon memory. Otomat never reads it back."
          : "The browser build keeps the key in daemon memory only — it is forgotten when the daemon restarts. Use the desktop app to store it encrypted."}
      </p>
      {submitError === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {submitError}
        </p>
      )}
    </form>
  );
}
