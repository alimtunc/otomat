import { RuntimeUnavailableError } from "#runtime/errors";
import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpDeclaresFlag, helpFlagValues } from "#runtime/probe/help-flags";

export const CODEX_EXEC_APPROVAL_NOTE =
  "When exec exposes no approval flag, its non-interactive transport only honors never; Otomat refuses other explicit policies.";

export function codexApprovalValues(help: string): string[] {
  const values = helpFlagValues(help, "--ask-for-approval");
  if (values !== null) return values;
  return helpDeclaresFlag(help, "--config") &&
    helpDeclaresFlag(help, "--dangerously-bypass-approvals-and-sandbox")
    ? ["never"]
    : [];
}

export function codexApprovalArgs(binary: string, policy: string | undefined): string[] {
  if (policy === undefined) return [];
  const probe = cachedProviderProbe(binary, ["exec", "--help"]);
  if (probe.status !== "ok" || !codexApprovalValues(probe.stdout).includes(policy)) {
    const detail = probe.status === "ok" ? CODEX_EXEC_APPROVAL_NOTE : probe.detail;
    throw new RuntimeUnavailableError(
      "codex",
      "permissions_unsupported",
      `Codex exec cannot honor requested approval policy "${policy}". ${detail} No turn was started.`,
    );
  }
  return helpDeclaresFlag(probe.stdout, "--ask-for-approval")
    ? ["--ask-for-approval", policy]
    : ["-c", `approval_policy="${policy}"`];
}
