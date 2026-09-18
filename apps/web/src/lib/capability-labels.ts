import type {
  RunInteractionKind,
  RuntimeCapabilities,
  RuntimeImageCapability,
  RuntimeInteractionCapability,
  RuntimeProviderLimitMode,
  RuntimeSteeringMode,
} from "@otomat/domain";

export interface CapabilityEntry {
  key: keyof RuntimeCapabilities;
  label: string;
  supported: boolean;
  hint: string | null;
}

const STEERING_LABELS = {
  live: "Steering the live session",
  turn_boundary: "Steering at next turn",
  unsupported: "Steering",
} satisfies Record<RuntimeSteeringMode, string>;

const PROVIDER_LIMIT_LABELS = {
  unsupported: "Quota detection",
  detects: "Quota detection",
  deadline: "Quota detection with reset time",
} satisfies Record<RuntimeProviderLimitMode, string>;

const INTERACTIONS_HINT =
  "Whether Otomat can answer a question the agent blocks on mid-run. It is not the run's permission mode, which the provider still applies on its own.";

const INTERACTION_KIND_LABELS = {
  permission: "approvals",
  choice: "choices",
  text: "written answers",
  questionnaire: "questionnaires",
} satisfies Record<RunInteractionKind, string>;

function imageLabel(capability: RuntimeImageCapability): string {
  if (capability.status === "unsupported") return "Images in messages";
  return capability.standalone
    ? "Images in messages, alone or with text"
    : "Images with a text message";
}

function interactionLabel(capability: RuntimeInteractionCapability): string {
  if (capability.status === "unsupported") return "Interactive answers";
  return `Interactive ${capability.kinds.map((kind) => INTERACTION_KIND_LABELS[kind]).join(" · ")}`;
}

/** The `satisfies` makes a capability added to the schema fail the build here instead of vanishing from the list. */
export function capabilityEntries(capabilities: RuntimeCapabilities): CapabilityEntry[] {
  const resumeModel = capabilities.resume_model;
  const images = capabilities.images;
  const interactions = capabilities.interactions;
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
    images: {
      key: "images",
      label: imageLabel(images),
      supported: images.status === "supported",
      hint: images.status === "unsupported" ? images.reason : null,
    },
    interactions: {
      key: "interactions",
      label: interactionLabel(interactions),
      supported: interactions.status === "supported",
      hint: interactions.status === "unsupported" ? interactions.reason : INTERACTIONS_HINT,
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
