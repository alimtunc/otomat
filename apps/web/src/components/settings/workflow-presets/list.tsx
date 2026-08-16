import type { WorkflowPresetContract, WorkflowPresetScope } from "@otomat/domain";
import { Button, EmptyState, ErrorState, Icon } from "@otomat/ui";
import type { useWorkflowPresets } from "@web/api/workflow-presets/queries";
import { WorkflowPresetRow } from "@web/components/settings/workflow-presets/row";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryList } from "@web/components/shell/query-list";
import { PRESET_SCOPE_LABEL } from "@web/lib/workflow/preset";

export interface WorkflowPresetListProps {
  presets: ReturnType<typeof useWorkflowPresets>;
  projectId: string | undefined;
  onCreate: () => void;
  onEdit: (preset: WorkflowPresetContract) => void;
}

const SCOPE_ORDER: WorkflowPresetScope[] = ["project", "global"];

function ScopeSection({
  scope,
  presets,
  projectId,
  onEdit,
}: {
  scope: WorkflowPresetScope;
  presets: WorkflowPresetContract[];
  projectId: string | undefined;
  onEdit: (preset: WorkflowPresetContract) => void;
}) {
  if (presets.length === 0) return null;
  return (
    <section className="flex flex-col">
      <h2 className="px-3 py-1.5 text-micro font-semibold tracking-[0.03em] text-text-tertiary">
        {PRESET_SCOPE_LABEL[scope]}
      </h2>
      <div className="rounded-lg border border-border-subtle bg-card">
        {presets.map((preset) => (
          <WorkflowPresetRow
            key={preset.id}
            preset={preset}
            projectId={projectId}
            onEdit={onEdit}
          />
        ))}
      </div>
    </section>
  );
}

export function WorkflowPresetList({
  presets,
  projectId,
  onCreate,
  onEdit,
}: WorkflowPresetListProps) {
  return (
    <QueryList
      query={presets}
      pending={<ListSkeleton rows={3} height={40} />}
      error={
        <ErrorState title="Couldn’t load workflow presets" onRetry={() => void presets.refetch()} />
      }
      empty={
        <EmptyState
          icon="workflow"
          variant="inline"
          title="No workflow preset yet"
          description="Save a workflow you keep rebuilding — its steps, their dependencies, the agent each one runs on and its static instructions."
          action={
            <Button variant="primary" size="sm" onClick={onCreate}>
              <Icon name="plus" aria-hidden />
              New preset
            </Button>
          }
        />
      }
    >
      {(items) => (
        <div className="flex flex-col gap-4">
          {SCOPE_ORDER.map((scope) => (
            <ScopeSection
              key={scope}
              scope={scope}
              presets={items.filter((preset) => preset.scope === scope)}
              projectId={projectId}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </QueryList>
  );
}
