import {
  PROVIDER_OPTION_KEYS,
  resolveExecutionModel,
  resolveExecutionOption,
  type AgentProfileContract,
  type ModelSelection,
  type ProviderOptionKey,
  type ProviderOptionSet,
  type ResolvedExecutionValue,
  type RuntimeModelCatalog,
} from "@otomat/domain";
import {
  useExecutionDefaults,
  useRuntimeModels,
  useRuntimeProviderOptions,
} from "@web/api/daemon/queries";
import { agentChoiceProfile, agentChoiceRuntimeId } from "@web/lib/agent/choice";
import { pickerLevels, type ExecutionLevelsInput } from "@web/lib/execution/levels";
import {
  scopedModelId,
  type ExecutionPickerLevel,
  type ExecutionSelection,
} from "@web/lib/execution/selection";
import type { ResolvedExecutionOption } from "@web/lib/execution/summary";

export interface UseExecutionConfigOptions {
  level: ExecutionPickerLevel;
  value: ExecutionSelection;
  inherited?: ExecutionSelection;
  profiles: AgentProfileContract[];
}

export interface ExecutionConfig {
  agentChoice: string | null;
  runtimeId: string | null;
  profile: AgentProfileContract | null;
  model: ResolvedExecutionValue<ModelSelection>;
  options: ResolvedExecutionOption[];
  stale: ProviderOptionKey[];
  catalog: RuntimeModelCatalog | undefined;
  catalogPending: boolean;
  catalogError: boolean;
  announced: ProviderOptionSet | undefined;
  announcedPending: boolean;
  announcedError: boolean;
  defaultsError: boolean;
  retry: () => void;
}

/** The model resolves first: the options a CLI announces are scoped to the model it will run. */
export function useExecutionConfig({
  level,
  value,
  inherited,
  profiles,
}: UseExecutionConfigOptions): ExecutionConfig {
  const defaults = useExecutionDefaults();
  const inheritsAgent = value.agent === null;
  const agentChoice = value.agent ?? inherited?.agent ?? null;
  const runtimeId = agentChoiceRuntimeId(agentChoice, profiles);
  const profile = agentChoiceProfile(agentChoice, profiles);
  const levelsInput: ExecutionLevelsInput = {
    level,
    own: value,
    inheritsAgent,
    profile,
    defaults: defaults.data,
    runtimeId,
  };
  if (inherited) levelsInput.inherited = { model: inherited.model, options: inherited.options };
  const levels = pickerLevels(levelsInput);
  const model = resolveExecutionModel(levels);
  const modelId = scopedModelId(model.value);
  const catalog = useRuntimeModels(runtimeId);
  const announced = useRuntimeProviderOptions(runtimeId, modelId);

  const descriptors = announced.data?.options ?? [];
  const options = descriptors.map((descriptor) => ({
    key: descriptor.key,
    descriptor,
    resolved: resolveExecutionOption(levels, descriptor.key),
  }));
  const stale =
    announced.data === undefined
      ? []
      : PROVIDER_OPTION_KEYS.filter((key) => {
          const selection = value.options[key];
          if (selection?.kind !== "value") return false;
          const descriptor = descriptors.find((candidate) => candidate.key === key);
          return !descriptor?.choices.some((choice) => choice.value === selection.value);
        });

  return {
    agentChoice,
    runtimeId,
    profile,
    model,
    options,
    stale,
    catalog: catalog.data,
    catalogPending: runtimeId !== null && catalog.isPending,
    catalogError: catalog.isError,
    announced: announced.data,
    announcedPending: runtimeId !== null && announced.isPending,
    announcedError: announced.isError,
    defaultsError: defaults.isError,
    retry: () => {
      void defaults.refetch();
      void catalog.refetch();
      void announced.refetch();
    },
  };
}
