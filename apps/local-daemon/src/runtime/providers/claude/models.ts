import type { RuntimeModel } from "@otomat/domain";

import { unsupportedDiscovery, type RuntimeModelSupport } from "#runtime/models/support";

/** The aliases the Claude Code CLI documents for `--model`; each is resolved by the CLI itself, never by Otomat. */
const CLAUDE_STATIC_MODELS: RuntimeModel[] = [
  {
    id: "opus",
    label: "Opus",
    description: "Alias for the latest Opus model, resolved by Claude Code.",
    source: "static",
  },
  {
    id: "sonnet",
    label: "Sonnet",
    description: "Alias for the latest Sonnet model, resolved by Claude Code.",
    source: "static",
  },
  {
    id: "fable",
    label: "Fable",
    description: "Alias for the latest Fable model, resolved by Claude Code.",
    source: "static",
  },
];

const CLAUDE_DISCOVERY_DETAIL =
  "Claude Code exposes no local model listing command, so this catalog is the documented static set plus any identifier you enter.";

export const CLAUDE_MODEL_SUPPORT: RuntimeModelSupport = {
  allowsCustom: true,
  staticModels: CLAUDE_STATIC_MODELS,
  discover: () => unsupportedDiscovery(CLAUDE_DISCOVERY_DETAIL),
};
