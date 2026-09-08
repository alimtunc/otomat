import type { ProviderOptions } from "@otomat/domain";

export function CodexPermissions({ options }: { options: ProviderOptions | null }) {
  return (
    <div className="text-xs leading-relaxed text-text-tertiary">
      <p>
        Requested permissions: sandbox{" "}
        {options === null ? "not recorded" : (options.sandbox ?? "Runtime default")}
        {" · "}approval{" "}
        {options === null ? "not recorded" : (options.approval_policy ?? "Runtime default")}
      </p>
      <p>
        Effective permissions: not reported by Codex CLI. Requested settings are not confirmation.
      </p>
    </div>
  );
}
