import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import {
  ProviderMark,
  type ProviderMarkName,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { ProviderOptionRow } from "@web/components/runs/launch/provider-option-row";
import {
  AGENT_CHOICE_DEFAULT,
  encodeProfileChoice,
  encodeRuntimeChoice,
} from "@web/lib/agent-choice";
import { isAvailableRuntime, runtimeById, runtimeMark } from "@web/lib/runtimes";

interface ChoiceItem {
  value: string;
  label: string;
  disabled: boolean;
  mark: ProviderMarkName | null;
}

function buildItems(
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

export interface LaunchAgentSelectProps {
  profiles: AgentProfileContract[];
  descriptors: RuntimeDescriptor[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  /** Adds a "Run default" option that maps to `null` (inherit). Used for per-step / per-candidate selectors. */
  includeDefault?: boolean;
  compact?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Chooses the agent for a launch: a saved profile or an ad-hoc runtime, grouped and capability-gated by availability. */
export function LaunchAgentSelect({
  profiles,
  descriptors,
  value,
  onValueChange,
  includeDefault = false,
  compact = false,
  disabled = false,
  ariaLabel = "Agent",
}: LaunchAgentSelectProps) {
  const { defaultItem, profileItems, runtimeItems } = buildItems(
    profiles,
    descriptors,
    includeDefault,
  );
  const items = [...(defaultItem ? [defaultItem] : []), ...profileItems, ...runtimeItems];
  const selected = items.find((item) => item.value === (value ?? AGENT_CHOICE_DEFAULT));

  return (
    <Select
      items={items}
      value={value ?? AGENT_CHOICE_DEFAULT}
      onValueChange={(next) => {
        if (next === null) return;
        onValueChange(next === AGENT_CHOICE_DEFAULT ? null : next);
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        disabled={disabled}
        className={compact ? "h-7 text-xs" : undefined}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.mark ? <ProviderMark name={selected.mark} /> : null}
          <SelectValue className="truncate" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {defaultItem ? (
          <SelectItem value={defaultItem.value}>
            <ProviderOptionRow mark={defaultItem.mark} label={defaultItem.label} />
          </SelectItem>
        ) : null}
        {profileItems.length > 0 ? (
          <SelectGroup>
            <SelectLabel>Profiles</SelectLabel>
            {profileItems.map((item) => (
              <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
                <ProviderOptionRow mark={item.mark} label={item.label} />
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        <SelectGroup>
          <SelectLabel>Runtimes</SelectLabel>
          {runtimeItems.map((item) => (
            <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
              <ProviderOptionRow mark={item.mark} label={item.label} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
