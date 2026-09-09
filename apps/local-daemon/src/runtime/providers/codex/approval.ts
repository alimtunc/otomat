import { codexPermissionProblem, codexApprovalPolicy, type ProviderOptions } from "@otomat/domain";

import { RuntimeUnavailableError } from "#runtime/errors";
import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpDeclaresFlag, helpFlagValues } from "#runtime/probe/help-flags";

export const CODEX_EXEC_APPROVAL_NOTE =
  "Codex non-interactive exec honors on-request with Approve for me; otherwise an exec without an approval flag only honors never. Unsupported permissions are refused before starting.";

export function supportsCodexReviewer(binary: string, help: string): boolean {
  if (helpDeclaresFlag(help, "--approve-for-me")) return true;
  const probe = cachedProviderProbe(binary, [
    "features",
    "list",
    "-c",
    'approvals_reviewer="auto_review"',
  ]);
  return (
    probe.status === "ok" && /^guardian_approval\s+\S+\s+(?:true|false)\s*$/m.test(probe.stdout)
  );
}

export function codexApprovalValues(help: string): string[] {
  const values = helpFlagValues(help, "--ask-for-approval");
  if (values !== null) return values;
  return helpDeclaresFlag(help, "--config") &&
    helpDeclaresFlag(help, "--dangerously-bypass-approvals-and-sandbox")
    ? ["never"]
    : [];
}

export function codexApprovalArgs(binary: string, options: ProviderOptions): string[] {
  const reviewer = options.approvals_reviewer;
  const automatic = reviewer === "auto_review";
  const policy = codexApprovalPolicy(options);
  if (policy === undefined && reviewer === undefined) return [];
  const probe = cachedProviderProbe(binary, ["exec", "--help"]);
  const problem = codexPermissionProblem(options);
  if (problem !== null)
    throw new RuntimeUnavailableError("codex", "permissions_unsupported", problem);
  if (
    reviewer !== undefined &&
    (probe.status !== "ok" ||
      !supportsCodexReviewer(binary, probe.stdout) ||
      (reviewer !== "user" && reviewer !== "auto_review"))
  ) {
    throw new RuntimeUnavailableError(
      "codex",
      "permissions_unsupported",
      `This Codex exec cannot honor approvals reviewer "${reviewer}". Update the CLI on the execution host and refresh its options, or explicitly choose supported permissions. No turn was started.`,
    );
  }
  if (policy === undefined) return ["-c", `approvals_reviewer="${reviewer}"`];
  if (
    probe.status !== "ok" ||
    (!codexApprovalValues(probe.stdout).includes(policy) && !(automatic && policy === "on-request"))
  ) {
    const detail = probe.status === "ok" ? CODEX_EXEC_APPROVAL_NOTE : probe.detail;
    throw new RuntimeUnavailableError(
      "codex",
      "permissions_unsupported",
      `Codex exec cannot honor requested approval policy "${policy}". ${detail} No turn was started.`,
    );
  }
  const args = helpDeclaresFlag(probe.stdout, "--ask-for-approval")
    ? ["--ask-for-approval", policy]
    : ["-c", `approval_policy="${policy}"`];
  if (reviewer !== undefined) args.push("-c", `approvals_reviewer="${reviewer}"`);
  return args;
}
