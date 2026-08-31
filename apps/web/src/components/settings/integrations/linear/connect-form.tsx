import type { LinearConnectionContract } from "@otomat/domain";
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

export interface LinearConnectFormProps {
  /** The connection this key replaces; null adds a new one to the catalogue. */
  connection?: LinearConnectionContract | null;
  onConnected?: () => void;
}

export function LinearConnectForm({ connection = null, onConnected }: LinearConnectFormProps) {
  const connect = useConnectLinear();
  const persists = desktopBridge() !== null;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { label: connection?.label ?? "", apiKey: "" },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        await connect.mutateAsync({
          id: connection?.id ?? crypto.randomUUID(),
          label: value.label.trim(),
          api_key: value.apiKey.trim(),
        });
        form.reset();
        toast.success(connection === null ? "Connected to Linear" : "Reconnected to Linear");
        onConnected?.();
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
      <form.Field name="label" validators={{ onChange: requiredTrimmed("Name this connection.") }}>
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldLabel>Name</FieldLabel>
            <FieldControl>
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setSubmitError(null);
                  field.handleChange(event.target.value);
                }}
                placeholder="Otomat workspace"
                aria-label="Linear connection name"
                autoComplete="off"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>

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
              <form.Subscribe
                selector={(state) => [state.values.label, state.values.apiKey] as const}
              >
                {([label, apiKey]) => (
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={connect.isPending}
                    disabled={
                      label.trim().length === 0 || apiKey.trim().length === 0 || connect.isPending
                    }
                  >
                    {connection === null ? "Connect" : "Reconnect"}
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
