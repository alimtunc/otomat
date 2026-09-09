import type { ProviderOptions } from "@otomat/domain";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";

export function CodexPermissions({ options }: { options: ProviderOptions | null }) {
  const reviewer = options?.approvals_reviewer;
  const reviewerLabel =
    reviewer === undefined
      ? "Runtime default"
      : providerOptionValueLabel("approvals_reviewer", reviewer);
  return (
    <div className="text-xs leading-relaxed text-text-tertiary">
      <p>
        Requested permissions: sandbox{" "}
        {options === null ? "not recorded" : (options.sandbox ?? "Runtime default")}
        {" · "}approval{" "}
        {options === null ? "not recorded" : (options.approval_policy ?? "Runtime default")}
        {" · "}reviewer {options === null ? "not recorded" : reviewerLabel}
      </p>
      {options?.approvals_reviewer === "auto_review" ? (
        <p>
          Approve for me can deny requests. The selected sandbox and managed restrictions still
          apply.
        </p>
      ) : null}
      <p>
        Effective permissions: not reported by Codex CLI. Requested settings are not confirmation.
      </p>
    </div>
  );
}
