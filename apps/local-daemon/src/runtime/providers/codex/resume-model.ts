import type { RuntimeResumeModelCapability } from "@otomat/domain";

import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpDeclaresFlag } from "#runtime/probe/help-flags";

const EXEC_HELP_ARGS = ["exec", "--help"] as const;
const RESUME_HELP_ARGS = ["exec", "resume", "--help"] as const;

export function codexResumeModelCapability(binary: string): RuntimeResumeModelCapability {
  const exec = cachedProviderProbe(binary, EXEC_HELP_ARGS);
  if (exec.status !== "ok") {
    return {
      status: "unsupported",
      reason: `Codex resume capability is unavailable: ${exec.detail}`,
    };
  }
  if (!helpDeclaresFlag(exec.stdout, "--model")) {
    return {
      status: "unsupported",
      reason: "This Codex CLI does not announce a model flag for exec turns.",
    };
  }
  const resume = cachedProviderProbe(binary, RESUME_HELP_ARGS);
  if (resume.status !== "ok") {
    return {
      status: "unsupported",
      reason: `This Codex CLI does not announce native exec resume: ${resume.detail}`,
    };
  }
  if (!/\bUsage:\s+codex\s+exec\s+resume\b/.test(resume.stdout)) {
    return {
      status: "unsupported",
      reason: "This Codex CLI does not announce a native exec resume subcommand.",
    };
  }
  return { status: "supported" };
}
