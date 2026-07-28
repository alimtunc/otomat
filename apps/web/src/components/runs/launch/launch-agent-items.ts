import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import type { ProviderMarkName } from "@otomat/ui";
import {
  AGENT_CHOICE_DEFAULT,
  encodeProfileChoice,
  encodeRuntimeChoice,
} from "@web/lib/agent-choice";
import { isAvailableRuntime, runtimeById, runtimeMark } from "@web/lib/runtimes";

export interface ChoiceItem {
  value: string;
  label: string;
  disabled: boolean;
  mark: ProviderMarkName | null;
}

export function buildItems(
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
  includeDefault: boolean,
): { defaultItem: ChoiceItem | null; profileItems: ChoiceItem[]; runtimeItems: ChoiceItem[] } {
  const profileItems = profiles.map((profile) => {
    const runtime = runtimeById(descriptors, profile.runtime);
    const available = runtime ? isAvailableRuntime(runtime) : false;
    return {
      value: encodeProfileChoice(profile.id),
      label: available ? profile.name : `${profile.name} — runtime unavailable`,
      disabled: !available,
      mark: runtimeMark(profile.runtime),
    };
  });
  const runtimeItems = descriptors.map((descriptor) => ({
    value: encodeRuntimeChoice(descriptor.id),
    label: descriptor.display_name,
    disabled: !isAvailableRuntime(descriptor),
    mark: runtimeMark(descriptor.id),
  }));
  return {
    defaultItem: includeDefault
      ? { value: AGENT_CHOICE_DEFAULT, label: "Run default", disabled: false, mark: null }
      : null,
    profileItems,
    runtimeItems,
  };
}
