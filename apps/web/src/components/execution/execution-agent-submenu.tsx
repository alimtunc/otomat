import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
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

function AgentItem({ item }: { item: ChoiceItem }) {
  return (
    <DropdownMenuRadioItem value={item.value} disabled={item.disabled}>
      <span className="flex min-w-0 items-center gap-2">
        {item.mark ? <ProviderMark name={item.mark} /> : null}
        <span className="truncate">{item.label}</span>
      </span>
    </DropdownMenuRadioItem>
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
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span>Agent</span>
          <span className="truncate text-xs text-text-tertiary">{effectiveLabel}</span>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuContent aria-label="Agent" className="max-w-80">
        <DropdownMenuRadioGroup
          value={value ?? AGENT_CHOICE_DEFAULT}
          onValueChange={(next) => {
            const chosen = String(next);
            onValueChange(chosen === AGENT_CHOICE_DEFAULT ? null : chosen);
          }}
        >
          {defaultItem ? <AgentItem item={defaultItem} /> : null}
          {profileItems.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Profiles</DropdownMenuLabel>
              {profileItems.map((item) => (
                <AgentItem key={item.value} item={item} />
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Runtimes</DropdownMenuLabel>
          {runtimeItems.map((item) => (
            <AgentItem key={item.value} item={item} />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuSub>
  );
}
