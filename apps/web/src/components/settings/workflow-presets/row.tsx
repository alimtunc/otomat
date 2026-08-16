import { planExecutableCount, type WorkflowPresetContract } from "@otomat/domain";
import { Chip, Icon } from "@otomat/ui";
import { WorkflowPresetRowActions } from "@web/components/settings/workflow-presets/row-actions";
import { presetBlockedReason } from "@web/lib/workflow/preset";

export interface WorkflowPresetRowProps {
  preset: WorkflowPresetContract;
  projectId: string | undefined;
  onEdit: (preset: WorkflowPresetContract) => void;
}

export function WorkflowPresetRow({ preset, projectId, onEdit }: WorkflowPresetRowProps) {
  const blocked = presetBlockedReason(preset);
  const turns = planExecutableCount(preset.plan.steps);

  return (
    <div className="flex items-start gap-3 border-b border-border-subtle px-3 py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{preset.name}</span>
          <Chip>{`${turns} step${turns === 1 ? "" : "s"}`}</Chip>
        </div>
        {blocked === null ? null : (
          <p className="flex items-start gap-1.5 text-xs text-warning">
            <Icon name="alert-triangle" aria-hidden className="mt-0.25 h-3.5 w-3.5 shrink-0" />
            {blocked}
          </p>
        )}
      </div>
      <WorkflowPresetRowActions preset={preset} projectId={projectId} onEdit={onEdit} />
    </div>
  );
}
