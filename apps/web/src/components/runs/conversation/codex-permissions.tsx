import { codexApprovalMode, type ProviderOptions } from "@otomat/domain";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@otomat/ui";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";

export function CodexPermissions({ options }: { options: ProviderOptions | null }) {
  const mode = options === null ? null : codexApprovalMode(options);
  const reviewer = options?.approvals_reviewer;
  const reviewerLabel =
    reviewer === undefined
      ? "Runtime default"
      : providerOptionValueLabel("approvals_reviewer", reviewer);
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-xs leading-relaxed text-text-tertiary">
      <p>Effective permissions unreported — requested settings are not confirmation.</p>
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="xs" />}>
          Permission details
        </PopoverTrigger>
        <PopoverContent className="max-w-96 space-y-2 p-3 text-xs text-text-secondary">
          <p>
            Approval mode:{" "}
            {mode === null
              ? "Legacy or runtime default"
              : providerOptionValueLabel("approval_mode", mode)}
          </p>
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
            Requested settings come from the saved configuration for this turn. Codex CLI does not
            report the effective permissions.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
