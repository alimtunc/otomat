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

export interface MappingOption {
  value: string;
  label: string;
}

export function MappingField({
  label,
  value,
  options,
  meta,
  onValueChange,
}: {
  label: string;
  value: string;
  options: MappingOption[];
  meta: FieldMetaLike;
  onValueChange(value: string): void;
}) {
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
