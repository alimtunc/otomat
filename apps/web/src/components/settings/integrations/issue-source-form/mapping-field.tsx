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

export interface MappingFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  meta: FieldMetaLike;
  onValueChange(value: string): void;
}

export function MappingField({ label, value, options, meta, onValueChange }: MappingFieldProps) {
  return (
    <Field {...fieldErrorProps(meta)}>
      <FieldLabel>{label}</FieldLabel>
      <Select
        items={options}
        value={value}
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
