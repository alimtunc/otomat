import { ConfigMenuChoice, ConfigMenuSubmenu, DropdownMenuRadioGroup } from "@otomat/ui";

export function Select({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  const selected = items.find((item) => item.value === value);

  return (
    <ConfigMenuSubmenu label={label} value={selected?.label ?? value}>
      <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(String(next))}>
        {items.map((item) => (
          <ConfigMenuChoice key={item.value} value={item.value} label={item.label} />
        ))}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
