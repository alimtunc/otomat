import { providerOptionDefault, type ProviderOptionSelection } from "@otomat/domain";
import {
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
} from "@otomat/ui";
import { MenuNote } from "@web/components/execution/menu-note";
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

/** Nothing outside `option.descriptor.choices` is listed: a value the CLI does not announce cannot be picked here at all. */
export function ExecutionOptionSubmenu({
  level,
  option,
  selection,
  onSelectionChange,
  profileName,
}: ExecutionOptionSubmenuProps) {
  const label = providerOptionKeyLabel(option.key);
  const effective = resolvedOptionLabel(option.resolved, option.descriptor, profileName);
  const recommended = providerOptionDefault(option.descriptor);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span>{label}</span>
          <span className="truncate text-xs text-text-tertiary">{effective}</span>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuContent aria-label={label} className="max-w-80">
        <MenuNote>{option.descriptor.description}</MenuNote>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={optionRadioValue(selection)}
          onValueChange={(next) => onSelectionChange(optionSelectionFromRadio(String(next)))}
        >
          <DropdownMenuRadioItem value={EXECUTION_INHERIT_VALUE}>
            {inheritLabel(level)}
          </DropdownMenuRadioItem>
          {offersAgentDefault(level) ? (
            <DropdownMenuRadioItem value={EXECUTION_AGENT_DEFAULT_VALUE}>
              Agent default
            </DropdownMenuRadioItem>
          ) : null}
          {option.descriptor.choices.map((choice) => (
            <DropdownMenuRadioItem key={choice.value} value={choice.value}>
              <span className="flex min-w-0 flex-col">
                <span>
                  {providerOptionValueLabel(choice.value)}
                  {choice.dangerous ? " — removes a safety boundary" : ""}
                  {choice.value === recommended ? " — recommended" : ""}
                </span>
                {choice.description === null ? null : (
                  <span className="text-xs whitespace-normal text-text-tertiary">
                    {choice.description}
                  </span>
                )}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuSub>
  );
}
