import type { ProviderOptions } from "../contracts/provider-options.js";

export function codexApprovalPolicy(options: ProviderOptions): string | undefined {
  return (
    options.approval_policy ??
    (options.approvals_reviewer === "auto_review" ? "on-request" : undefined)
  );
}

export function codexPermissionProblem(options: ProviderOptions): string | null {
  if (options.approvals_reviewer !== "auto_review") return null;
  if (
    options.sandbox !== undefined &&
    !["read-only", "workspace-write"].includes(options.sandbox)
  ) {
    return "Approve for me requires a confined sandbox: choose read-only or workspace-write.";
  }
  if (options.approval_policy !== undefined && options.approval_policy !== "on-request") {
    return "Approve for me requires approval policy on-request. With never, no request reaches automatic review.";
  }
  return null;
}
