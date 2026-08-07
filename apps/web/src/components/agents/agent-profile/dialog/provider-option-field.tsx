import type { ProviderOptionChoice, ProviderOptionDescriptor } from "@otomat/domain";
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { providerOptionKeyLabel, providerOptionValueLabel } from "@web/lib/provider-option-labels";
import {
  providerOptionItems,
  RUNTIME_DEFAULT_OPTION,
  type ProviderOptionItem,
} from "@web/lib/provider-options";
import { useState } from "react";

export interface ProviderOptionFieldProps {
  descriptor: ProviderOptionDescriptor;
  /** Null selects the runtime default. A value the installed CLI no longer announces still owns the trigger, labelled as such. */
  value: string | null;
  onValueChange: (value: string | null) => void;
}

/** The option's own description, plus whatever the CLI says about the value in the trigger. */
function hintFor(descriptor: ProviderOptionDescriptor, value: string | null): string {
  const selected = descriptor.choices.find((choice) => choice.value === value);
  if (!selected?.description) return descriptor.description;
  return `${descriptor.description} ${selected.description}`;
}

function dangerWarning(choice: ProviderOptionChoice): string {
  const head = `${providerOptionValueLabel(choice.value)} removes a safety boundary.`;
  return choice.description === null ? head : `${head} ${choice.description}`;
}

export function ProviderOptionField({
  descriptor,
  value,
  onValueChange,
}: ProviderOptionFieldProps) {
  const [pending, setPending] = useState<string | null>(null);
  const label = providerOptionKeyLabel(descriptor.key);
  const items: ProviderOptionItem[] = providerOptionItems(descriptor, value);
  const stale = items.some((item) => item.value === value && item.stale);
  const confirming = descriptor.choices.find((choice) => choice.value === pending);
  const error = stale
    ? `The installed CLI no longer announces “${value}”. Pick another value.`
    : null;

  return (
    <Field invalid={stale} hint={hintFor(descriptor, value)} error={error}>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl>
        <Select
          items={items}
          value={value ?? RUNTIME_DEFAULT_OPTION}
          onValueChange={(next) => {
            if (next === null) return;
            const chosen = next === RUNTIME_DEFAULT_OPTION ? null : next;
            // A boundary-removing value is never stored on a single click.
            const dangerous = descriptor.choices.some(
              (choice) => choice.value === chosen && choice.dangerous,
            );
            setPending(dangerous ? chosen : null);
            if (!dangerous) onValueChange(chosen);
          }}
        >
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldControl>
      {confirming === undefined ? null : (
        <div className="flex flex-col gap-1.5 rounded-md bg-danger-bg p-2">
          <p role="alert" className="text-xs text-danger">
            {dangerWarning(confirming)}
          </p>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                onValueChange(confirming.value);
                setPending(null);
              }}
            >
              Store it anyway
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={() => setPending(null)}>
              Keep the current value
            </Button>
          </div>
        </div>
      )}
    </Field>
  );
}
