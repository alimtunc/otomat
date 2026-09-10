import {
  PROVIDER_OPTION_KEYS,
  codexApprovalMode,
  isCodexPermissionKey,
  isCodexTechnicalPermissionKey,
} from "@otomat/domain";
import type { ProviderOptionKey, ProviderOptions, ProviderOptionSet } from "@otomat/domain";
import {
  ConfigMenu,
  ConfigMenuContent,
  ConfigMenuNote,
  ConfigMenuTrigger,
  DropdownMenuItem,
} from "@otomat/ui";
import { DangerConfirm, type DangerConfirmProps } from "@web/components/execution/danger-confirm";
import { ExecutionOptionSubmenu } from "@web/components/execution/execution-option-submenu";
import { providerOptionKeyLabel, providerOptionValueLabel } from "@web/lib/provider-option-labels";
import { unsupportedProviderOptions } from "@web/lib/provider-options";
import { useState } from "react";

function approvalSummary(mode: string | null, hasSavedPermissions: boolean): string {
  if (mode !== null) return providerOptionValueLabel("approval_mode", mode);
  return hasSavedPermissions ? "Saved permissions" : "Runtime default";
}

export function NextTurnPermissions({
  value,
  onChange,
  support,
  error,
}: {
  value: ProviderOptions;
  onChange: (value: ProviderOptions) => void;
  support: ProviderOptionSet;
  error: string | null;
}) {
  const [pending, setPending] = useState<DangerConfirmProps["pending"] | null>(null);
  const mode = codexApprovalMode(value);
  const hasSavedPermissions = PROVIDER_OPTION_KEYS.some(
    (key) => isCodexTechnicalPermissionKey(key) && value[key] !== undefined,
  );
  const apply = (key: ProviderOptionKey, selected: string | undefined): void => {
    const options = { ...value };
    if (key === "approval_mode") {
      for (const candidate of PROVIDER_OPTION_KEYS) {
        if (isCodexTechnicalPermissionKey(candidate)) delete options[candidate];
      }
    }
    if (selected === undefined) delete options[key];
    else options[key] = selected;
    setPending(null);
    onChange(options);
  };
  return (
    <div>
      <ConfigMenu>
        <ConfigMenuTrigger
          label="Approval mode for next turn"
          summary={approvalSummary(mode, hasSavedPermissions)}
          announce="Approval mode for next turn"
        />
        <ConfigMenuContent>
          {unsupportedProviderOptions(value, support)
            .filter((stored) => isCodexPermissionKey(stored.key))
            .map((stored) => (
              <ConfigMenuNote key={stored.key}>
                Unsupported saved {providerOptionKeyLabel(stored.key)}:{" "}
                {providerOptionValueLabel(stored.key, stored.value)}. Choose a supported value or
                use runtime permission defaults.
              </ConfigMenuNote>
            ))}
          {mode === null && hasSavedPermissions ? (
            <ConfigMenuNote>
              This turn uses saved technical permissions. Choose an approval mode to replace them,
              or leave them unchanged.
            </ConfigMenuNote>
          ) : null}
          {support.options
            .filter(
              (option) => isCodexPermissionKey(option.key) && option.user_configurable !== false,
            )
            .map((descriptor) => {
              const selected = descriptor.key === "approval_mode" ? mode : value[descriptor.key];
              return (
                <ExecutionOptionSubmenu
                  key={descriptor.key}
                  level="turn"
                  profileName={null}
                  option={{
                    key: descriptor.key,
                    descriptor,
                    resolved: { value: selected ?? null, source: "turn" },
                  }}
                  selection={
                    selected === undefined || selected === null
                      ? undefined
                      : { kind: "value", value: selected }
                  }
                  onSelectionChange={(selection) => {
                    const next = selection?.kind === "value" ? selection.value : undefined;
                    const choice = descriptor.choices.find((entry) => entry.value === next);
                    if (choice?.dangerous) setPending({ key: descriptor.key, choice });
                    else apply(descriptor.key, next);
                  }}
                />
              );
            })}
          <ConfigMenuNote>{support.detection.detail}</ConfigMenuNote>
          <DropdownMenuItem
            onClick={() => {
              const options = { ...value };
              delete options.sandbox;
              delete options.approval_policy;
              delete options.approvals_reviewer;
              delete options.approval_mode;
              setPending(null);
              onChange(options);
            }}
          >
            Use runtime permission defaults
          </DropdownMenuItem>
        </ConfigMenuContent>
      </ConfigMenu>
      {error === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {pending === null ? null : (
        <DangerConfirm
          pending={pending}
          onConfirm={() => apply(pending.key, pending.choice.value)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
