import type { RuntimeDescriptor } from "@otomat/domain";
import {
  ProviderMark,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { ProviderOptionRow } from "@web/components/runs/launch/provider-option-row";
import { isAvailableRuntime, isRealRuntime, runtimeMark } from "@web/lib/runtimes";

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
    mark: runtimeMark(descriptor.id),
  }));
  const selectedMark = items.find((item) => item.value === value)?.mark ?? null;

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <SelectTrigger aria-label="Runtime" disabled={disabled}>
        <span className="flex min-w-0 items-center gap-2">
          {selectedMark ? <ProviderMark name={selectedMark} /> : null}
          <SelectValue className="truncate" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
            <ProviderOptionRow mark={item.mark} label={item.label} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
