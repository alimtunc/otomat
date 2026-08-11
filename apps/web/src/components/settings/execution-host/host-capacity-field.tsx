import type { ExecutionHostId } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel, Input } from "@otomat/ui";
import { useState, type FormEvent } from "react";

import { useHostCapacity } from "./use-host-capacity";

const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

const INVALID = "Enter a whole number of sessions, 1 or more.";

const IMPACT =
  "Launches past this limit are created immediately and start in order as slots free up. Raising it starts queued runs at once; lowering it never stops a session already running.";

export interface HostCapacityFieldProps {
  hostId: ExecutionHostId;
  hostLabel: string;
}

export function HostCapacityField({ hostId, hostLabel }: HostCapacityFieldProps) {
  const capacity = useHostCapacity(hostId);
  const [draft, setDraft] = useState<string | null>(null);
  const applied = capacity.capacity;
  const value = draft ?? (applied === undefined ? "" : String(applied.max_concurrent_sessions));
  const loading = applied === undefined && capacity.loadError === null;
  const valid = POSITIVE_INTEGER.test(value.trim());
  const invalid = !loading && !valid;
  const error = capacity.loadError ?? (invalid ? INVALID : capacity.saveError);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    void capacity.save(Number(value.trim())).then((saved) => {
      if (saved) setDraft(null);
    });
  }

  return (
    <form className="pt-1" onSubmit={submit}>
      <Field invalid={invalid} hint={IMPACT} error={error}>
        <FieldLabel>Maximum concurrent agent sessions</FieldLabel>
        <div className="flex items-center gap-2">
          <FieldControl>
            <Input
              value={value}
              inputMode="numeric"
              className="w-16"
              disabled={loading}
              spellCheck={false}
              aria-label={`Maximum concurrent agent sessions on ${hostLabel}`}
              onChange={(event) => setDraft(event.target.value)}
            />
          </FieldControl>
          <Button
            type="submit"
            size="sm"
            loading={capacity.saving}
            disabled={!valid || capacity.saving || loading}
          >
            Apply
          </Button>
          {applied === undefined ? null : (
            <span className="text-xs text-text-tertiary">
              Applying {applied.max_concurrent_sessions} — {applied.active_sessions} active,{" "}
              {applied.waiting_sessions} queued
            </span>
          )}
        </div>
      </Field>
    </form>
  );
}
