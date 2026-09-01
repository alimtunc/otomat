import type { WorkflowPresetContract } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { useWorkflowPresets } from "@web/api/workflow-presets/queries";
import { SectionHeading } from "@web/components/settings/section-heading";
import { WorkflowPresetList } from "@web/components/settings/workflow-presets/list";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { WorkflowPresetDialog } from "@web/components/workflow/preset/preset-dialog";
import { useState } from "react";

export function WorkflowPresetsSection() {
  const { projectId } = useSelectedProject();
  const presets = useWorkflowPresets(projectId);
  const [editing, setEditing] = useState<{ preset: WorkflowPresetContract | null } | null>(null);

  return (
    <div>
      <SectionHeading
        title="Workflow presets"
        description="Reusable workflow structures: steps, their dependencies, the agent each one runs on and its static instructions. Applying one fills the launcher; the issue is attached at launch."
      />
      <div className="mb-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setEditing({ preset: null })}>
          <Icon name="plus" aria-hidden />
          New preset
        </Button>
      </div>
      <WorkflowPresetList
        presets={presets}
        projectId={projectId}
        onEdit={(preset) => setEditing({ preset })}
      />
      {editing === null ? null : (
        <WorkflowPresetDialog
          key={editing.preset?.id ?? "new"}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          preset={editing.preset}
          projectId={projectId}
        />
      )}
    </div>
  );
}
