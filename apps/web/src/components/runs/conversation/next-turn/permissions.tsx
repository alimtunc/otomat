import { isCodexPermissionKey } from "@otomat/domain";
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
  const apply = (key: ProviderOptionKey, selected: string | undefined): void => {
    const options = { ...value };
    if (selected === undefined) delete options[key];
    else options[key] = selected;
    setPending(null);
    onChange(options);
  };
  return (
    <div>
      <ConfigMenu>
        <ConfigMenuTrigger
          label="Permissions for next turn"
          summary="Permissions"
          announce="Permissions for next turn"
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
          {support.options
            .filter((option) => isCodexPermissionKey(option.key))
            .map((descriptor) => {
              const selected = value[descriptor.key];
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
                    selected === undefined ? undefined : { kind: "value", value: selected }
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
