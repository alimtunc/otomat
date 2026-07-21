import { Button, Field, FieldControl, FieldLabel, Input, toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import {
  isSupersededLinearError,
  linearErrorMessage,
  useConnectLinear,
} from "@web/api/linear/mutations";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { useState } from "react";

export function LinearConnectForm({ connectionError }: { connectionError: string | null }) {
  const connect = useConnectLinear();
  const persists = desktopBridge() !== null;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dismissedConnectionError, setDismissedConnectionError] = useState<string | null>(null);
  const visibleError =
    submitError ?? (connectionError === dismissedConnectionError ? null : connectionError);

  const form = useForm({
    defaultValues: { apiKey: "" },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        await connect.mutateAsync(value.apiKey.trim());
        form.reset();
        toast.success("Connected to Linear");
      } catch (error) {
        if (isSupersededLinearError(error)) return;
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
                      setDismissedConnectionError(connectionError);
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
      {visibleError === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {visibleError}
        </p>
      )}
    </form>
  );
}
