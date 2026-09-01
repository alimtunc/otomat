import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import {
  ConfigMenuChoice,
  ConfigMenuSubmenu,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  ProviderMark,
} from "@otomat/ui";
import { buildItems, type ChoiceItem } from "@web/components/execution/agent-items";
import { AGENT_CHOICE_DEFAULT, type AgentScope } from "@web/lib/agent/choice";

export interface ExecutionAgentSubmenuProps {
  profiles: AgentProfileContract[];
  descriptors: RuntimeDescriptor[];
  skills: SkillContract[];
  hostLabel: string;
  value: string | null;
  onValueChange: (value: string | null) => void;
  inheritLabel?: string;
  scope?: AgentScope;
  effectiveLabel: string;
}

function agentChoice(item: ChoiceItem) {
  return (
    <ConfigMenuChoice
      key={item.value}
      value={item.value}
      label={item.label}
      disabled={item.disabled}
      leading={item.mark ? <ProviderMark name={item.mark} /> : null}
    />
  );
}

export function ExecutionAgentSubmenu({
  profiles,
  descriptors,
  skills,
  hostLabel,
  value,
  onValueChange,
  inheritLabel,
  scope = "all",
  effectiveLabel,
}: ExecutionAgentSubmenuProps) {
  const { defaultItem, profileItems, runtimeItems } = buildItems(
    scope === "runtimes" ? [] : profiles,
    descriptors,
    skills,
    hostLabel,
    inheritLabel,
  );

  return (
    <ConfigMenuSubmenu label="Agent" value={effectiveLabel}>
      <DropdownMenuRadioGroup
        value={value ?? AGENT_CHOICE_DEFAULT}
        onValueChange={(next) => {
          const chosen = String(next);
          onValueChange(chosen === AGENT_CHOICE_DEFAULT ? null : chosen);
        }}
      >
        {defaultItem ? agentChoice(defaultItem) : null}
        {profileItems.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Profiles</DropdownMenuLabel>
            {profileItems.map(agentChoice)}
          </>
        ) : null}
        {scope === "profiles" ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Runtimes</DropdownMenuLabel>
            {runtimeItems.map(agentChoice)}
          </>
        )}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
