import type { RuntimeCapabilities, RuntimeSteeringMode } from "@otomat/domain";

export interface CapabilityEntry {
  key: keyof RuntimeCapabilities;
  label: string;
  supported: boolean;
  hint: string | null;
}

/** Steering is a guarantee level, not a yes/no, so the label names the level the CLI actually offers. */
const STEERING_LABELS = {
  turn_boundary: "Steering at next turn",
  unsupported: "Steering",
} satisfies Record<RuntimeSteeringMode, string>;

const APPROVALS_HINT =
  "Whether Otomat can answer a permission question mid-run. It is not the run's permission mode, which the provider still applies on its own.";

/** The `satisfies` is the guarantee: a capability added to the schema fails the build here instead of vanishing from the list. */
export function capabilityEntries(capabilities: RuntimeCapabilities): CapabilityEntry[] {
  return Object.values({
    steering: {
      key: "steering",
      label: STEERING_LABELS[capabilities.steering],
      supported: capabilities.steering !== "unsupported",
      hint: null,
    },
    stream: { key: "stream", label: "Stream", supported: capabilities.stream, hint: null },
    abort: { key: "abort", label: "Abort", supported: capabilities.abort, hint: null },
    resume: { key: "resume", label: "Resume", supported: capabilities.resume, hint: null },
    permissions: {
      key: "permissions",
      label: "Interactive approvals",
      supported: capabilities.permissions,
      hint: APPROVALS_HINT,
    },
    diff_hints: {
      key: "diff_hints",
      label: "Diff hints",
      supported: capabilities.diff_hints,
      hint: null,
    },
  } satisfies Record<keyof RuntimeCapabilities, CapabilityEntry>);
}
