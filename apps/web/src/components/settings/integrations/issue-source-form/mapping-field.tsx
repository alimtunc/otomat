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
import { fieldErrorProps, type FieldMetaLike } from "@web/lib/form";

const UNVALIDATED: FieldMetaLike = { isTouched: false, isValid: true, errors: [] };

export interface MappingFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  /** Omitted for a plain selection, which carries no touched state of its own. */
  meta?: FieldMetaLike;
  disabled?: boolean;
  onValueChange(value: string): void;
}

export function MappingField({
  label,
  value,
  options,
  meta = UNVALIDATED,
  disabled = false,
  onValueChange,
}: MappingFieldProps) {
  return (
    <Field {...fieldErrorProps(meta)}>
      <FieldLabel>{label}</FieldLabel>
      <Select
        items={options}
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => {
          if (nextValue !== null) onValueChange(nextValue);
        }}
      >
        <FieldControl>
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
        </FieldControl>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
