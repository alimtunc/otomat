import {
  providerOptionDefault,
  type ProviderOptionChoice,
  type ProviderOptionKey,
  type ProviderOptionSelection,
} from "@otomat/domain";
import {
  ConfigMenuChoice,
  ConfigMenuNote,
  ConfigMenuSubmenu,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
} from "@otomat/ui";
import { resolvedOptionLabel } from "@web/lib/execution/labels";
import {
  EXECUTION_AGENT_DEFAULT_VALUE,
  EXECUTION_INHERIT_VALUE,
  inheritLabel,
  offersAgentDefault,
  optionRadioValue,
  optionSelectionFromRadio,
  type ExecutionPickerLevel,
} from "@web/lib/execution/selection";
import type { ResolvedExecutionOption } from "@web/lib/execution/summary";
import { providerOptionKeyLabel, providerOptionValueLabel } from "@web/lib/provider-option-labels";

export interface ExecutionOptionSubmenuProps {
  level: ExecutionPickerLevel;
  option: ResolvedExecutionOption;
  selection: ProviderOptionSelection | undefined;
  onSelectionChange: (selection: ProviderOptionSelection | undefined) => void;
  /** Named on the profile entry so "from the agent" is never anonymous. */
  profileName: string | null;
}

function choiceLabel(
  key: ProviderOptionKey,
  choice: ProviderOptionChoice,
  recommended: boolean,
): string {
  const marks = [
    choice.dangerous ? "removes a safety boundary" : null,
    recommended ? "recommended" : null,
  ]
    .filter((mark) => mark !== null)
    .join(", ");
  const label = providerOptionValueLabel(key, choice.value);
  return marks === "" ? label : `${label} — ${marks}`;
}

/** Nothing outside `option.descriptor.choices` is listed: a value the CLI does not announce cannot be picked here at all. */
export function ExecutionOptionSubmenu({
  level,
  option,
  selection,
  onSelectionChange,
  profileName,
}: ExecutionOptionSubmenuProps) {
  const label = providerOptionKeyLabel(option.key);
  const recommended = providerOptionDefault(option.descriptor);

  return (
    <ConfigMenuSubmenu
      label={label}
      value={resolvedOptionLabel(option.resolved, option.descriptor, profileName)}
    >
      <ConfigMenuNote>{option.descriptor.description}</ConfigMenuNote>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup
        value={optionRadioValue(selection)}
        onValueChange={(next) => onSelectionChange(optionSelectionFromRadio(String(next)))}
      >
        <ConfigMenuChoice value={EXECUTION_INHERIT_VALUE} label={inheritLabel(level)} />
        {offersAgentDefault(level) ? (
          <ConfigMenuChoice value={EXECUTION_AGENT_DEFAULT_VALUE} label="Agent default" />
        ) : null}
        {option.descriptor.choices.map((choice) => (
          <ConfigMenuChoice
            key={choice.value}
            value={choice.value}
            label={choiceLabel(option.key, choice, choice.value === recommended)}
            description={choice.description}
          />
        ))}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
