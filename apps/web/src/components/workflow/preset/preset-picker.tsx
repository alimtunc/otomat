import type { WorkflowPresetContract } from "@otomat/domain";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
} from "@otomat/ui";
import { useWorkflowPresets } from "@web/api/workflow-presets/queries";
import { PRESET_SCOPE_LABEL, presetBlockedReason } from "@web/lib/workflow/preset";

export interface WorkflowPresetPickerProps {
  projectId: string;
  onApply: (preset: WorkflowPresetContract) => void;
  onSaveCurrent: () => void;
}

function ScopeGroup({
  label,
  presets,
  onApply,
}: {
  label: string;
  presets: WorkflowPresetContract[];
  onApply: (preset: WorkflowPresetContract) => void;
}) {
  if (presets.length === 0) return null;
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {presets.map((preset) => {
        const blocked = presetBlockedReason(preset);
        return (
          <DropdownMenuItem
            key={preset.id}
            disabled={blocked !== null}
            onClick={() => onApply(preset)}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{preset.name}</span>
              {blocked === null ? null : (
                <span className="truncate text-xs text-text-tertiary">{blocked}</span>
              )}
            </span>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuGroup>
  );
}

/**
 * Fills the composition from a saved preset. The preset is read, never written: whatever the
 * launcher does to the applied steps afterwards stays in the draft.
 */
export function WorkflowPresetPicker({
  projectId,
  onApply,
  onSaveCurrent,
}: WorkflowPresetPickerProps) {
  const presets = useWorkflowPresets(projectId);
  const items = presets.data ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Icon name="workflow" aria-hidden />
            Presets
          </Button>
        }
      />
      <DropdownMenuContent align="start" aria-label="Workflow presets">
        {items.length === 0 ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {presets.isError ? "Couldn’t load presets" : "No preset saved yet"}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        ) : null}
        <ScopeGroup
          label={PRESET_SCOPE_LABEL.project}
          presets={items.filter((preset) => preset.scope === "project")}
          onApply={onApply}
        />
        <ScopeGroup
          label={PRESET_SCOPE_LABEL.global}
          presets={items.filter((preset) => preset.scope === "global")}
          onApply={onApply}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSaveCurrent}>Save this workflow as a preset…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
