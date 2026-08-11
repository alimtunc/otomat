import type { LinearWorkflowState } from "@otomat/domain";
import {
  Field,
  FieldControl,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";

// Select needs a concrete value, and "" is not distinguishable from a blank render.
const UNMAPPED = "__unmapped__";

export interface LifecyclePhaseSelectProps {
  label: string;
  /** Null while the phase is unmapped: Otomat then writes nothing for it. */
  value: string | null;
  states: readonly LinearWorkflowState[];
  disabled: boolean;
  onValueChange(stateId: string | null): void;
}

export function LifecyclePhaseSelect({
  label,
  value,
  states,
  disabled,
  onValueChange,
}: LifecyclePhaseSelectProps) {
  const items = [
    { value: UNMAPPED, label: "Not mapped" },
    ...states.map((state) => ({ value: state.id, label: state.name })),
  ];
  return (
    <Field className="min-w-0 flex-1">
      <FieldLabel>{label}</FieldLabel>
      <Select
        items={items}
        value={value ?? UNMAPPED}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next === UNMAPPED ? null : next);
        }}
      >
        <FieldControl>
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
        </FieldControl>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
