import type { RuntimeDescriptor, RuntimeUnavailableReason } from "@otomat/domain";

const UNAVAILABLE_LABELS = {
  binary_not_found: "CLI not found",
  not_enabled: "Not enabled",
  sandbox_unavailable: "Sandbox unavailable",
} satisfies Record<RuntimeUnavailableReason, string>;

export function runtimeAvailabilityLabel(
  descriptor: RuntimeDescriptor | undefined,
  hostLabel: string,
): string {
  if (descriptor === undefined) return `Not reported on ${hostLabel}`;
  if (descriptor.availability.status === "available") return `Available on ${hostLabel}`;
  return `${UNAVAILABLE_LABELS[descriptor.availability.reason]} on ${hostLabel}`;
}
