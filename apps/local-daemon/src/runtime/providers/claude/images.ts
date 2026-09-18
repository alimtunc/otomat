import type { RuntimeImageCapability } from "@otomat/domain";

import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpFlagValues } from "#runtime/probe/help-flags";

const HELP_ARGS = ["--help"] as const;

/** An image rides the same streaming-input user frame as the prompt, so the channel that carries text is what announces images. */
export function claudeImageCapability(binary: string): RuntimeImageCapability {
  const probe = cachedProviderProbe(binary, HELP_ARGS);
  if (probe.status !== "ok") {
    return {
      status: "unsupported",
      reason: `Claude Code image capability is unavailable: ${probe.detail}`,
    };
  }
  if (!helpFlagValues(probe.stdout, "--input-format")?.includes("stream-json")) {
    return {
      status: "unsupported",
      reason:
        "This Claude Code does not announce stream-json input, which is how an image reaches it.",
    };
  }
  return { status: "supported", standalone: true };
}
