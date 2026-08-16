import type { ModelSelection, ResolvedExecutionValue, RuntimeModelCatalog } from "@otomat/domain";
import {
  ConfigMenuChoice,
  ConfigMenuNote,
  ConfigMenuSubmenu,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
} from "@otomat/ui";
import { resolvedModelLabel } from "@web/lib/execution/labels";
import { inheritLabel, type ExecutionPickerLevel } from "@web/lib/execution/selection";
import { catalogNote, modelChoiceItems } from "@web/lib/model-choice";

export interface ExecutionModelSubmenuProps {
  level: ExecutionPickerLevel;
  catalog: RuntimeModelCatalog | undefined;
  catalogPending: boolean;
  catalogError: boolean;
  selected: string;
  model: ResolvedExecutionValue<ModelSelection>;
  onSelect: (value: string) => void;
  profileName: string | null;
}

export function ExecutionModelSubmenu({
  level,
  catalog,
  catalogPending,
  catalogError,
  selected,
  model,
  onSelect,
  profileName,
}: ExecutionModelSubmenuProps) {
  const items = modelChoiceItems(catalog, {
    inheritLabel: inheritLabel(level),
    offerProviderDefault: level === "step" || level === "launch",
    selected,
  });
  const note = catalogNote(catalog, catalogPending, catalogError);

  return (
    <ConfigMenuSubmenu
      label="Model"
      value={resolvedModelLabel(model, profileName)}
      hint={catalog?.discovery.detail}
    >
      {note === null ? null : (
        <>
          <ConfigMenuNote>{note}</ConfigMenuNote>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuRadioGroup value={selected} onValueChange={(next) => onSelect(String(next))}>
        {items.map((item) => (
          <ConfigMenuChoice key={item.value} value={item.value} label={item.label} />
        ))}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
