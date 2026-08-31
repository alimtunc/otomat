import type { ExecutionHostId } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { fieldErrorProps } from "@web/lib/form";

import { useHostCapacity } from "./use-host-capacity";

const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

const INVALID = "Enter a whole number of sessions, 1 or more.";

const IMPACT =
  "Launches past this limit are created immediately and start in order as slots free up. Raising it starts queued runs at once; lowering it never stops a session already running.";

function isSessionCount(value: string): boolean {
  return POSITIVE_INTEGER.test(value.trim());
}

export interface HostCapacityFieldProps {
  hostId: ExecutionHostId;
  hostLabel: string;
}

export function HostCapacityField({ hostId, hostLabel }: HostCapacityFieldProps) {
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
      if (await capacity.save(Number(sessions))) form.reset({ sessions });
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
              hint={IMPACT}
              error={capacity.loadError ?? fieldError.error ?? capacity.saveError}
            >
              <FieldLabel>Maximum concurrent agent sessions</FieldLabel>
              <div className="flex items-center gap-2">
                <FieldControl>
                  <Input
                    value={field.state.value}
                    inputMode="numeric"
                    className="w-16"
                    disabled={loading}
                    spellCheck={false}
                    aria-label={`Maximum concurrent agent sessions on ${hostLabel}`}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </FieldControl>
                <form.Subscribe selector={(state) => state.values.sessions.trim()}>
                  {(sessions) => (
                    <Button
                      type="submit"
                      size="sm"
                      loading={capacity.saving}
                      disabled={
                        !isSessionCount(sessions) ||
                        (applied !== undefined &&
                          sessions === String(applied.max_concurrent_sessions)) ||
                        capacity.saving ||
                        loading
                      }
                    >
                      Apply
                    </Button>
                  )}
                </form.Subscribe>
                {applied === undefined ? null : (
                  <span className="text-xs text-text-tertiary">
                    Applying {applied.max_concurrent_sessions} — {applied.active_sessions} active,{" "}
                    {applied.waiting_sessions} queued
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
