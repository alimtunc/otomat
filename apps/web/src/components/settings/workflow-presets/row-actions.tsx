import type { WorkflowPresetContract, WorkflowPresetScope } from "@otomat/domain";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Icon,
  IconButton,
  toast,
  DropdownMenuTrigger,
} from "@otomat/ui";
import {
  useDeleteWorkflowPreset,
  useDuplicateWorkflowPreset,
} from "@web/api/workflow-presets/mutations";
import { PRESET_SCOPE_LABEL } from "@web/lib/workflow/preset";
import { presetRefusalMessage } from "@web/lib/workflow/preset-error";
import { useState } from "react";

export interface WorkflowPresetRowActionsProps {
  preset: WorkflowPresetContract;
  projectId: string | undefined;
  onEdit: (preset: WorkflowPresetContract) => void;
}

export function WorkflowPresetRowActions({
  preset,
  projectId,
  onEdit,
}: WorkflowPresetRowActionsProps) {
  const duplicate = useDuplicateWorkflowPreset();
  const remove = useDeleteWorkflowPreset();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const copyInto = (scope: WorkflowPresetScope): void => {
    const request =
      scope === "project" && projectId !== undefined
        ? ({ scope: "project", project_id: projectId } as const)
        : ({ scope: "global" } as const);
    duplicate.mutate(
      { id: preset.id, request },
      {
        onSuccess: (copy) => toast.success(`Copied as “${copy.name}”`),
        onError: (error) => toast.error(presetRefusalMessage(error, "duplicate this preset")),
      },
    );
  };

  if (confirmingDelete) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="destructive"
          size="xs"
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(preset.id, {
              onSuccess: () => toast.success("Preset deleted"),
              onError: (error) => {
                toast.error(presetRefusalMessage(error, "delete this preset"));
                setConfirmingDelete(false);
              },
            })
          }
        >
          Confirm
        </Button>
        <Button autoFocus variant="ghost" size="xs" onClick={() => setConfirmingDelete(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            label={`Actions for ${preset.name}`}
            size="sm"
            icon={<Icon name="more-horizontal" />}
            className="ml-auto"
          />
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(preset)}>Edit</DropdownMenuItem>
        <DropdownMenuItem disabled={duplicate.isPending} onClick={() => copyInto("global")}>
          {`Duplicate into ${PRESET_SCOPE_LABEL.global}`}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={duplicate.isPending || projectId === undefined}
          onClick={() => copyInto("project")}
        >
          {`Duplicate into ${PRESET_SCOPE_LABEL.project}`}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger" onClick={() => setConfirmingDelete(true)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
