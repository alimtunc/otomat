import type { RuntimeCapabilities, RuntimeSteeringMode } from "@otomat/domain";

export interface CapabilityEntry {
  key: keyof RuntimeCapabilities;
  label: string;
  supported: boolean;
}

/** Steering is a guarantee level, not a yes/no, so the label names the level the CLI actually offers. */
const STEERING_LABELS = {
  turn_boundary: "Steering at next turn",
  unsupported: "Steering",
} satisfies Record<RuntimeSteeringMode, string>;

/** The `satisfies` is the guarantee: a capability added to the schema fails the build here instead of vanishing from the list. */
export function capabilityEntries(capabilities: RuntimeCapabilities): CapabilityEntry[] {
  return Object.values({
    steering: {
      key: "steering",
      label: STEERING_LABELS[capabilities.steering],
      supported: capabilities.steering !== "unsupported",
    },
    stream: { key: "stream", label: "Stream", supported: capabilities.stream },
    abort: { key: "abort", label: "Abort", supported: capabilities.abort },
    resume: { key: "resume", label: "Resume", supported: capabilities.resume },
    permissions: { key: "permissions", label: "Permissions", supported: capabilities.permissions },
    diff_hints: { key: "diff_hints", label: "Diff hints", supported: capabilities.diff_hints },
  } satisfies Record<keyof RuntimeCapabilities, CapabilityEntry>);
}
