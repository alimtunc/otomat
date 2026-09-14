import type { ExecutionHostId } from "@otomat/domain";
import { Field, FieldControl, FieldLabel, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { SavedNotice } from "@web/components/settings/saved-notice";
import { fieldErrorProps } from "@web/lib/form";
import { useState } from "react";

import { useHostCapacity } from "./use-host-capacity";

const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

const INVALID = "Enter a whole number of sessions, 1 or more.";

function isSessionCount(value: string): boolean {
  return POSITIVE_INTEGER.test(value.trim());
}

export interface HostCapacityFieldProps {
  hostId: ExecutionHostId;
  hostLabel: string;
}

export function HostCapacityField({ hostId, hostLabel }: HostCapacityFieldProps) {
  const [saved, setSaved] = useState(false);
  const capacity = useHostCapacity(hostId);
  const applied = capacity.capacity;
  const loading = applied === undefined && capacity.loadError === null;

  // The applied cap seeds the field until the operator edits it: TanStack only reseeds an untouched form.
  const form = useForm({
    defaultValues: {
      sessions: applied === undefined ? "" : String(applied.max_concurrent_sessions),
    },
    onSubmit: async ({ value }) => {
      const sessions = value.sessions.trim();
      if (
        capacity.saving ||
        !isSessionCount(sessions) ||
        sessions === String(applied?.max_concurrent_sessions)
      )
        return;
      if (await capacity.save(Number(sessions))) {
        form.reset({ sessions });
        setSaved(true);
      }
    },
  });

  return (
    <form
      className="pt-1"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="sessions"
        validators={{ onChange: ({ value }) => (isSessionCount(value) ? undefined : INVALID) }}
      >
        {(field) => {
          const fieldError = fieldErrorProps(field.state.meta);
          return (
            <Field
              invalid={fieldError.invalid || capacity.loadError !== null}
              error={capacity.loadError ?? fieldError.error ?? capacity.saveError}
            >
              <FieldLabel>Maximum concurrent agent sessions</FieldLabel>
              <div className="flex items-center gap-2">
                <FieldControl>
                  <Input
                    value={field.state.value}
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className="w-16"
                    disabled={loading || capacity.saving}
                    spellCheck={false}
                    aria-label={`Maximum concurrent agent sessions on ${hostLabel}`}
                    onBlur={() => {
                      field.handleBlur();
                      if (!loading) void form.handleSubmit();
                    }}
                    onChange={(event) => {
                      setSaved(false);
                      field.handleChange(event.target.value);
                    }}
                  />
                </FieldControl>
                {saved ? <SavedNotice>Saved</SavedNotice> : null}
                {applied === undefined ? null : (
                  <span className="text-xs text-text-tertiary">
                    {applied.active_sessions} active · {applied.waiting_sessions} queued
                  </span>
                )}
              </div>
            </Field>
          );
        }}
      </form.Field>
    </form>
  );
}
