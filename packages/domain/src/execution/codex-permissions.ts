import type { ProviderOptions } from "../contracts/provider-options.js";

export function codexApprovalModeOptions(mode: string): ProviderOptions | null {
  if (mode === "ask_for_approval") {
    return { sandbox: "workspace-write", approval_policy: "on-request" };
  }
  if (mode === "approve_for_me") {
    return {
      sandbox: "workspace-write",
      approval_policy: "on-request",
      approvals_reviewer: "auto_review",
    };
  }
  if (mode === "full_access") {
    return { sandbox: "danger-full-access", approval_policy: "never" };
  }
  return null;
}

export function codexApprovalMode(
  options: ProviderOptions,
): "ask_for_approval" | "approve_for_me" | "full_access" | null {
  if (options.approval_mode === "ask_for_approval") return "ask_for_approval";
  if (options.approval_mode === "approve_for_me") return "approve_for_me";
  if (options.approval_mode === "full_access") return "full_access";
  return null;
}

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
