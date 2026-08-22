import type {
  RuntimeCapabilities,
  RuntimeProviderLimitMode,
  RuntimeSteeringMode,
} from "@otomat/domain";

export interface CapabilityEntry {
  key: keyof RuntimeCapabilities;
  label: string;
  supported: boolean;
  hint: string | null;
}

/** Steering is a guarantee level, not a yes/no, so the label names the level the CLI actually offers. */
const STEERING_LABELS = {
  live: "Steering the live session",
  turn_boundary: "Steering at next turn",
  unsupported: "Steering",
} satisfies Record<RuntimeSteeringMode, string>;

/** A quota is only useful to schedule around when the CLI also says when it reopens, so the label names which of the two the runtime offers. */
const PROVIDER_LIMIT_LABELS = {
  unsupported: "Quota detection",
  detects: "Quota detection",
  deadline: "Quota detection with reset time",
} satisfies Record<RuntimeProviderLimitMode, string>;

const APPROVALS_HINT =
  "Whether Otomat can answer a permission question mid-run. It is not the run's permission mode, which the provider still applies on its own.";

/** The `satisfies` is the guarantee: a capability added to the schema fails the build here instead of vanishing from the list. */
export function capabilityEntries(capabilities: RuntimeCapabilities): CapabilityEntry[] {
  const resumeModel = capabilities.resume_model;
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
    resume_model: {
      key: "resume_model",
      label: "Model override on resume",
      supported: resumeModel.status === "supported",
      hint: resumeModel.status === "unsupported" ? resumeModel.reason : null,
    },
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
    provider_limit: {
      key: "provider_limit",
      label: PROVIDER_LIMIT_LABELS[capabilities.provider_limit],
      supported: capabilities.provider_limit !== "unsupported",
      hint: null,
    },
  } satisfies Record<keyof RuntimeCapabilities, CapabilityEntry>);
}
