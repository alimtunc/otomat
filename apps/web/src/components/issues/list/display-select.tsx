import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@otomat/ui";
import { asMember } from "@web/lib/coerce";

export interface DisplaySelectProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function DisplaySelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: DisplaySelectProps<T>) {
  const values = options.map((option) => option.value);
  return (
    <Select
      items={[...options]}
      value={value}
      onValueChange={(next) => {
        const picked = asMember(next, values);
        if (picked !== null) onChange(picked);
      }}
    >
      <SelectTrigger aria-label={label} className="w-auto">
        <span className="flex items-center gap-1.5">
          <span className="text-text-tertiary">{label}</span>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
