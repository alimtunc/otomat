import type {
  AgentProfileContract,
  GitHubConnectionContract,
  LinearConnectionContract,
  ProviderOptionSet,
  RuntimeDescriptor,
  RuntimeModelCatalog,
} from "@otomat/domain";

/** The sandbox probes nothing, so every catalog says so instead of claiming a detection it never ran. */
const NOT_PROBED = {
  status: "unsupported",
  detail: "The sandbox probes no provider binary.",
} as const;

export const SANDBOX_RUNTIMES: RuntimeDescriptor[] = [
  {
    id: "claude",
    display_name: "Claude Code",
    kind: "real",
    capabilities: {
      stream: true,
      steering: "live",
      abort: true,
      resume: true,
      resume_model: { status: "supported" },
      interactions: { status: "supported", kinds: ["permission"] },
      diff_hints: false,
      provider_limit: "deadline",
    },
    availability: { status: "available", version: "2.4.0" },
  },
  {
    id: "codex",
    display_name: "Codex",
    kind: "real",
    capabilities: {
      stream: true,
      steering: "unsupported",
      abort: true,
      resume: true,
      resume_model: { status: "supported" },
      interactions: { status: "unsupported", reason: "This runtime has no approval channel." },
      diff_hints: false,
      provider_limit: "detects",
    },
    availability: { status: "available", version: "0.147.0" },
  },
];

export function sandboxModels(runtime: string): RuntimeModelCatalog {
  return { runtime, allows_custom: false, discovery: NOT_PROBED, models: [] };
}

export function sandboxOptions(runtime: string): ProviderOptionSet {
  return { runtime, model: null, detection: NOT_PROBED, options: [] };
}

export const SANDBOX_PROFILES: AgentProfileContract[] = [
  {
    id: "sandbox-profile-1",
    name: "Implementer",
    runtime: "claude",
    options: {},
    model: null,
    guidance: "Work inside the issue's acceptance criteria and keep the diff small.",
    skill_ids: [],
  },
];

export const SANDBOX_GITHUB: GitHubConnectionContract = {
  status: "disconnected",
  login: null,
  device_authorization: null,
  error_code: null,
  error_message: null,
};

export const SANDBOX_LINEAR: LinearConnectionContract[] = [];
