import type { RuntimeResumeModelCapability } from "@otomat/domain";

import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpDeclaresFlag } from "#runtime/probe/help-flags";

const HELP_ARGS = ["--help"] as const;

export function claudeResumeModelCapability(binary: string): RuntimeResumeModelCapability {
  const probe = cachedProviderProbe(binary, HELP_ARGS);
  if (probe.status !== "ok") {
    return {
      status: "unsupported",
      reason: `Claude Code resume capability is unavailable: ${probe.detail}`,
    };
  }
  if (!helpDeclaresFlag(probe.stdout, "--resume")) {
    return { status: "unsupported", reason: "This Claude Code does not announce native resume." };
  }
  if (!helpDeclaresFlag(probe.stdout, "--model")) {
    return {
      status: "unsupported",
      reason: "This Claude Code does not announce a model flag for resumed turns.",
    };
  }
  return { status: "supported" };
}
