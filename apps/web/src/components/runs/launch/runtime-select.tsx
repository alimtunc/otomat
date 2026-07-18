import type { RuntimeDescriptor } from "@otomat/domain";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@otomat/ui";
import { isAvailableRuntime, isRealRuntime } from "@web/lib/runtimes";

function runtimeItemLabel(descriptor: RuntimeDescriptor): string {
  const devSuffix = isRealRuntime(descriptor) ? "" : " (dev only)";
  const unavailableSuffix = isAvailableRuntime(descriptor) ? "" : " — not installed";
  return `${descriptor.display_name}${devSuffix}${unavailableSuffix}`;
}

export function RuntimeSelect({
  descriptors,
  value,
  onValueChange,
  disabled = false,
}: {
  descriptors: RuntimeDescriptor[];
  value: string | null;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const items = descriptors.map((descriptor) => ({
    value: descriptor.id,
    label: runtimeItemLabel(descriptor),
    disabled: !isAvailableRuntime(descriptor),
  }));

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <SelectTrigger aria-label="Runtime" disabled={disabled}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
