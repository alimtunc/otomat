import type { RuntimeDescriptor } from "@otomat/domain";
import { Chip } from "@otomat/ui";

export function RuntimeAvailability({ descriptor }: { descriptor: RuntimeDescriptor | undefined }) {
  if (!descriptor) return <Chip tone="warning">Runtime not reported</Chip>;
  if (descriptor.availability.status === "available") {
    return <Chip tone="success">Runtime available</Chip>;
  }
  return <Chip tone="warning">Runtime unavailable</Chip>;
}
