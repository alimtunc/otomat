import type {
  AgentProfileContract,
  ProviderOptionSelection,
  RuntimeDescriptor,
} from "@otomat/domain";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  Input,
  ProviderMark,
} from "@otomat/ui";
import { agentChoiceItem } from "@web/components/execution/agent-items";
import { DangerConfirm, type DangerConfirmProps } from "@web/components/execution/danger-confirm";
import { ExecutionAgentSubmenu } from "@web/components/execution/execution-agent-submenu";
import { ExecutionModelSubmenu } from "@web/components/execution/execution-model-submenu";
import { ExecutionOptionSubmenu } from "@web/components/execution/execution-option-submenu";
import { MenuNote } from "@web/components/execution/menu-note";
import { useExecutionConfig } from "@web/components/execution/use-execution-config";
import { announcedOptionsNote } from "@web/lib/execution/labels";
import {
  EMPTY_EXECUTION_SELECTION,
  inheritLabel,
  withAgentSelection,
  withModelSelection,
  withOptionSelection,
  type ExecutionPickerLevel,
  type ExecutionSelection,
} from "@web/lib/execution/selection";
import { executionSummarySegments, type ResolvedExecutionOption } from "@web/lib/execution/summary";
import {
  catalogNote,
  isCompleteModelSelection,
  MODEL_CUSTOM_VALUE,
  modelSelectionFromValue,
  modelSelectValue,
} from "@web/lib/model-choice";
import { providerOptionKeyLabel } from "@web/lib/provider-option-labels";
import { useState } from "react";

export interface ExecutionConfigPickerProps {
  level: ExecutionPickerLevel;
  value: ExecutionSelection;
  onChange: (value: ExecutionSelection) => void;
  inherited?: ExecutionSelection;
  profiles: AgentProfileContract[];
  descriptors: RuntimeDescriptor[];
  runtimesOnly?: boolean;
  /** Prefixes every accessible name, so several pickers on one page stay distinguishable. */
  label: string;
  compact?: boolean;
  disabled?: boolean;
}

export function ExecutionConfigPicker({
  level,
  value,
  onChange,
  inherited,
  profiles,
  descriptors,
  runtimesOnly = false,
  label,
  compact = false,
  disabled = false,
}: ExecutionConfigPickerProps) {
  const [pending, setPending] = useState<DangerConfirmProps["pending"] | null>(null);
  const config = useExecutionConfig({ level, value, inherited, profiles });
  const chosen = agentChoiceItem(config.agentChoice, profiles, descriptors);

  /** A boundary-removing value waits for its own confirmation; everything else applies at once. */
  const selectOption = (
    option: ResolvedExecutionOption,
    selection: ProviderOptionSelection | undefined,
  ): void => {
    const picked =
      selection?.kind === "value"
        ? (option.descriptor.choices.find((entry) => entry.value === selection.value) ?? null)
        : null;
    if (picked?.dangerous) {
      setPending({ key: option.key, choice: picked });
      return;
    }
    setPending(null);
    onChange(withOptionSelection(value, option.key, selection));
  };

  const apply = (next: ExecutionSelection): void => {
    setPending(null);
    onChange(next);
  };

  const agentLabel = chosen?.label ?? "No agent";
  const profileName = config.profile?.name ?? null;
  const modelValue = modelSelectValue(value.model, config.catalog);
  const isCustomModel = modelValue === MODEL_CUSTOM_VALUE;
  const segments = executionSummarySegments(agentLabel, config.model, config.options);
  const note = announcedOptionsNote(
    config.announced,
    config.announcedPending,
    config.announcedError,
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size={compact ? "xs" : "sm"}
              disabled={disabled}
              aria-label={`${label} execution configuration: ${segments.join(", ")}`}
              className="min-w-0 max-w-full justify-start gap-1.5"
            >
              {chosen?.mark ? <ProviderMark name={chosen.mark} /> : null}
              <span className={cn("truncate", compact && "text-xs")}>{segments.join(" · ")}</span>
              <Icon name="chevron-down" aria-hidden className="shrink-0 text-text-tertiary" />
            </Button>
          }
        />
        <DropdownMenuContent aria-label={`${label} execution configuration`} className="min-w-72">
          <ExecutionAgentSubmenu
            profiles={profiles}
            descriptors={descriptors}
            value={value.agent}
            onValueChange={(agent) => apply(withAgentSelection(agent))}
            {...(inherited ? { inheritLabel: inheritLabel(level) } : {})}
            runtimesOnly={runtimesOnly}
            effectiveLabel={agentLabel}
          />
          <ExecutionModelSubmenu
            level={level}
            catalog={config.catalog}
            note={catalogNote(config.catalog, config.catalogPending, config.catalogError)}
            selected={modelValue}
            model={config.model}
            onSelect={(next) =>
              apply(withModelSelection(value, modelSelectionFromValue(next, value.model)))
            }
            profileName={profileName}
          />
          {config.options.map((option) => (
            <ExecutionOptionSubmenu
              key={option.key}
              level={level}
              option={option}
              selection={value.options[option.key]}
              onSelectionChange={(selection) => selectOption(option, selection)}
              profileName={profileName}
            />
          ))}
          {config.defaultsError ? (
            <>
              <DropdownMenuSeparator />
              <MenuNote>
                The daemon could not report the global defaults, so they are left out of what this
                shows.
              </MenuNote>
            </>
          ) : null}
          {note === null ? null : (
            <>
              <DropdownMenuSeparator />
              <MenuNote>{note}</MenuNote>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => apply(EMPTY_EXECUTION_SELECTION)}>
            Reset to defaults
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isCustomModel ? (
        <Input
          value={value.model?.kind === "model" ? value.model.id : ""}
          aria-label={`${label} custom model identifier`}
          placeholder="Model identifier the provider accepts"
          invalid={!isCompleteModelSelection(value.model)}
          className={cn("w-auto min-w-0", compact && "h-7 text-xs")}
          onChange={(event) =>
            apply(withModelSelection(value, { kind: "model", id: event.target.value }))
          }
        />
      ) : null}
      {pending === null ? null : (
        <DangerConfirm
          pending={pending}
          onConfirm={() =>
            apply(
              withOptionSelection(value, pending.key, {
                kind: "value",
                value: pending.choice.value,
              }),
            )
          }
          onCancel={() => setPending(null)}
        />
      )}
      {config.stale.map((key) => (
        <p key={key} role="alert" className="text-xs text-danger">
          {`This runtime and model no longer announce the selected ${providerOptionKeyLabel(key)}. Pick another value — a launch with it is refused.`}
        </p>
      ))}
      {config.announcedError || config.catalogError || config.defaultsError ? (
        <Button type="button" variant="ghost" size="xs" onClick={config.retry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
