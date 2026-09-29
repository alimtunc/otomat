import type { RuntimeModelCatalog } from "@otomat/domain";
import {
  ConfigMenuChoice,
  ConfigMenuNote,
  ConfigMenuSubmenu,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
} from "@otomat/ui";
import { modelLabel } from "@web/lib/execution/labels";
import {
  catalogModelLabel,
  catalogNote,
  MODEL_PROVIDER_DEFAULT_VALUE,
} from "@web/lib/model-choice";

export function NextTurnModelSubmenu({
  catalog,
  catalogPending,
  catalogError,
  model,
  onPick,
}: {
  catalog: RuntimeModelCatalog | undefined;
  catalogPending: boolean;
  catalogError: boolean;
  model: string | null;
  onPick: (model: string | null) => void;
}) {
  const note = catalogNote(catalog, catalogPending, catalogError);
  return (
    <ConfigMenuSubmenu
      label="Model"
      value={catalogModelLabel(catalog, model)}
      hint={catalog?.discovery.detail}
    >
      {note === null ? null : (
        <>
          <ConfigMenuNote>{note}</ConfigMenuNote>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuRadioGroup
        value={model ?? MODEL_PROVIDER_DEFAULT_VALUE}
        onValueChange={(value) =>
          onPick(value === MODEL_PROVIDER_DEFAULT_VALUE ? null : String(value))
        }
      >
        <ConfigMenuChoice value={MODEL_PROVIDER_DEFAULT_VALUE} label={modelLabel(null)} />
        {(catalog?.models ?? []).map((entry) => (
          <ConfigMenuChoice
            key={entry.id}
            value={entry.id}
            label={entry.label}
            hint={entry.label === entry.id ? undefined : entry.id}
          />
        ))}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
