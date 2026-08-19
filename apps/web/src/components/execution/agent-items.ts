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
  kind: "default" | "profile" | "runtime";
}

interface AgentChoiceItems {
  defaultItem: ChoiceItem | null;
  profileItems: ChoiceItem[];
  runtimeItems: ChoiceItem[];
}

export function buildItems(
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
  inheritLabel?: string,
): AgentChoiceItems {
  const profileItems: ChoiceItem[] = profiles.map((profile) => {
    const runtime = runtimeById(descriptors, profile.runtime);
    const available = runtime ? isAvailableRuntime(runtime) : false;
    return {
      value: encodeProfileChoice(profile.id),
      label: available ? profile.name : `${profile.name} — runtime unavailable`,
      disabled: !available,
      mark: runtimeMark(profile.runtime),
      kind: "profile",
    };
  });
  const runtimeItems: ChoiceItem[] = descriptors.map((descriptor) => ({
    value: encodeRuntimeChoice(descriptor.id),
    label: descriptor.display_name,
    disabled: !isAvailableRuntime(descriptor),
    mark: runtimeMark(descriptor.id),
    kind: "runtime",
  }));
  return {
    defaultItem: inheritLabel
      ? {
          value: AGENT_CHOICE_DEFAULT,
          label: inheritLabel,
          disabled: false,
          mark: null,
          kind: "default",
        }
      : null,
    profileItems,
    runtimeItems,
  };
}

export function agentChoiceItem(
  choice: string | null,
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
): ChoiceItem | null {
  const { profileItems, runtimeItems } = buildItems(profiles, descriptors);
  return [...profileItems, ...runtimeItems].find((item) => item.value === choice) ?? null;
}
