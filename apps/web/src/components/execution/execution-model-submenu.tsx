import type { ModelSelection, ResolvedExecutionValue, RuntimeModelCatalog } from "@otomat/domain";
import {
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
} from "@otomat/ui";
import { MenuNote } from "@web/components/execution/menu-note";
import { resolvedModelLabel } from "@web/lib/execution/labels";
import { inheritLabel, type ExecutionPickerLevel } from "@web/lib/execution/selection";
import { modelChoiceItems } from "@web/lib/model-choice";

export interface ExecutionModelSubmenuProps {
  level: ExecutionPickerLevel;
  catalog: RuntimeModelCatalog | undefined;
  note: string | null;
  selected: string;
  model: ResolvedExecutionValue<ModelSelection>;
  onSelect: (value: string) => void;
  profileName: string | null;
}

export function ExecutionModelSubmenu({
  level,
  catalog,
  note,
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

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span>Model</span>
          <span className="truncate text-xs text-text-tertiary">
            {resolvedModelLabel(model, profileName)}
          </span>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuContent aria-label="Model" className="max-w-80">
        {note === null ? null : (
          <>
            <MenuNote>{note}</MenuNote>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuRadioGroup value={selected} onValueChange={(next) => onSelect(String(next))}>
          {items.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuSub>
  );
}
