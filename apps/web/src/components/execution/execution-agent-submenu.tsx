import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import {
  ConfigMenuChoice,
  ConfigMenuSubmenu,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  ProviderMark,
} from "@otomat/ui";
import { buildItems, type ChoiceItem } from "@web/components/execution/agent-items";
import { AGENT_CHOICE_DEFAULT } from "@web/lib/agent-choice";

export interface ExecutionAgentSubmenuProps {
  profiles: AgentProfileContract[];
  descriptors: RuntimeDescriptor[];
  /** Null inherits the level above; the entry only exists when `inheritLabel` is given. */
  value: string | null;
  onValueChange: (value: string | null) => void;
  /** Omitted where the agent must be named, as on a run-level launcher. */
  inheritLabel?: string;
  /** Hides the saved profiles, for a surface that configures one runtime rather than picking an agent. */
  runtimesOnly?: boolean;
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
  value,
  onValueChange,
  inheritLabel,
  runtimesOnly = false,
  effectiveLabel,
}: ExecutionAgentSubmenuProps) {
  const { defaultItem, profileItems, runtimeItems } = buildItems(
    runtimesOnly ? [] : profiles,
    descriptors,
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
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Runtimes</DropdownMenuLabel>
        {runtimeItems.map(agentChoice)}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
