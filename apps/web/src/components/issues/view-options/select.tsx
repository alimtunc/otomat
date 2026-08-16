import { ConfigMenuChoice, ConfigMenuSubmenu, DropdownMenuRadioGroup } from "@otomat/ui";
import { asMember } from "@web/lib/coerce";

export function Select<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const selected = items.find((item) => item.value === value);

  return (
    <ConfigMenuSubmenu label={label} value={selected?.label ?? value}>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) => {
          const picked = asMember(
            next,
            items.map((item) => item.value),
          );
          if (picked !== null) onChange(picked);
        }}
      >
        {items.map((item) => (
          <ConfigMenuChoice key={item.value} value={item.value} label={item.label} />
        ))}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
