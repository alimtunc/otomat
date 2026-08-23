import type {
  AgentProfileContract,
  ProviderOptionSelection,
  RuntimeDescriptor,
} from "@otomat/domain";
import {
  cn,
  ConfigMenu,
  ConfigMenuContent,
  ConfigMenuNote,
  ConfigMenuProblem,
  ConfigMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Input,
  ProviderMark,
} from "@otomat/ui";
import { agentChoiceItem } from "@web/components/execution/agent-items";
import { DangerConfirm, type DangerConfirmProps } from "@web/components/execution/danger-confirm";
import { ExecutionAgentSubmenu } from "@web/components/execution/execution-agent-submenu";
import { ExecutionModelSubmenu } from "@web/components/execution/execution-model-submenu";
import { ExecutionOptionSubmenu } from "@web/components/execution/execution-option-submenu";
import { ExecutionSummaryDetail } from "@web/components/execution/execution-summary-detail";
import { useExecutionConfig } from "@web/components/execution/use-execution-config";
import type { AgentScope } from "@web/lib/agent-choice";
import { executionDetectionProblem, noAnnouncedOptionsNote } from "@web/lib/execution/detection";
import {
  EMPTY_EXECUTION_SELECTION,
  inheritLabel,
  withAgentSelection,
  withModelSelection,
  withOptionSelection,
  type ExecutionPickerLevel,
  type ExecutionSelection,
} from "@web/lib/execution/selection";
import {
  executionSummaryDetails,
  executionSummarySegments,
  type ResolvedExecutionOption,
} from "@web/lib/execution/summary";
import {
  isCompleteModelSelection,
  MODEL_CUSTOM_VALUE,
  modelSelectionFromValue,
  modelSelectValue,
} from "@web/lib/model-choice";
import { providerOptionKeyLabel } from "@web/lib/provider-option-labels";
import { isRealRuntime, runtimeById, SIMULATED_RUNTIME_NOTE } from "@web/lib/runtimes";
import { useState } from "react";

export interface ExecutionConfigPickerProps {
  level: ExecutionPickerLevel;
  value: ExecutionSelection;
  onChange: (value: ExecutionSelection) => void;
  inherited?: ExecutionSelection;
  profiles: AgentProfileContract[];
  descriptors: RuntimeDescriptor[];
  scope?: AgentScope;
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
  scope = "all",
  label,
  compact = false,
  disabled = false,
}: ExecutionConfigPickerProps) {
  const [pending, setPending] = useState<DangerConfirmProps["pending"] | null>(null);
  const config = useExecutionConfig({ level, value, inherited, profiles });
  const chosen = agentChoiceItem(config.agentChoice, profiles, descriptors);

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
  const segments = executionSummarySegments(config.model, config.options);
  const announced = [agentLabel, ...segments];
  const summary = chosen?.kind === "runtime" && chosen.mark ? segments : announced;
  const profileName = config.profile?.name ?? null;
  const modelValue = modelSelectValue(value.model, config.catalog);
  const menuLabel = `${label} execution configuration`;
  const emptyNote = noAnnouncedOptionsNote(config.announced);
  const chosenRuntime =
    config.runtimeId === null ? undefined : runtimeById(descriptors, config.runtimeId);
  const simulated = chosenRuntime !== undefined && !isRealRuntime(chosenRuntime);
  const problem = executionDetectionProblem({
    announced: config.announcedError,
    catalog: config.catalogError,
    defaults: config.defaultsError,
  });

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <ConfigMenu>
        <ConfigMenuTrigger
          label={menuLabel}
          summary={summary.join(" · ")}
          announce={announced.join(" · ")}
          detail={
            <ExecutionSummaryDetail
              entries={executionSummaryDetails(
                agentLabel,
                config.model,
                config.options,
                profileName,
              )}
              detection={config.announced?.detection.detail ?? null}
            />
          }
          leading={chosen?.mark ? <ProviderMark name={chosen.mark} /> : null}
          size={compact ? "xs" : "sm"}
          disabled={disabled}
          pending={config.announcedPending || config.catalogPending}
        />
        <ConfigMenuContent aria-label={menuLabel}>
          <ExecutionAgentSubmenu
            profiles={profiles}
            descriptors={descriptors}
            value={value.agent}
            onValueChange={(agent) => apply(withAgentSelection(agent))}
            {...(inherited ? { inheritLabel: inheritLabel(level) } : {})}
            scope={scope}
            effectiveLabel={agentLabel}
          />
          <ExecutionModelSubmenu
            level={level}
            catalog={config.catalog}
            catalogPending={config.catalogPending}
            catalogError={config.catalogError}
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
          {simulated ? <ConfigMenuNote>{SIMULATED_RUNTIME_NOTE}</ConfigMenuNote> : null}
          {emptyNote === null ? null : <ConfigMenuNote>{emptyNote}</ConfigMenuNote>}
          {problem === null ? null : (
            <>
              <DropdownMenuSeparator />
              <ConfigMenuProblem message={problem} onRetry={config.retry} />
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => apply(EMPTY_EXECUTION_SELECTION)}>
            Reset to defaults
          </DropdownMenuItem>
        </ConfigMenuContent>
      </ConfigMenu>
      {modelValue === MODEL_CUSTOM_VALUE ? (
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
    </div>
  );
}
