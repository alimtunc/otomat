import { contextReferenceKey, type ContextReference, type IssueContract } from "@otomat/domain";
import { Icon, IconButton } from "@otomat/ui";
import { AddContextPopover } from "@web/components/context/add-context-popover";
import { AttachedContextRow } from "@web/components/context/attached-context-row";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import { BaseBranchControl } from "@web/components/runs/launch/base-branch-control";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";
import { addContextReference, removeContextReference } from "@web/lib/context/draft";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { submitOnCmdEnter } from "@web/lib/form";
import type { ReactNode } from "react";

export interface LaunchComposerProps {
  issue: IssueContract | null;
  target: ReadyLaunchTarget;
  references: readonly ContextReference[];
  onReferencesChange: (references: readonly ContextReference[]) => void;
  execution: LaunchExecution;
  onExecutionChange: (execution: ExecutionSelection) => void;
  label: string;
  action: string;
  unavailableReason: string | null;
  pending: boolean;
  onSubmit: () => void;
  children: ReactNode;
}

export function LaunchComposer({
  issue,
  target,
  references,
  onReferencesChange,
  execution,
  onExecutionChange,
  label,
  action,
  unavailableReason,
  pending,
  onSubmit,
  children,
}: LaunchComposerProps) {
  const projectId = target.repository.project_id;
  const name = unavailableReason === null ? action : `${action} — ${unavailableReason}`;
  const submit = (): void => {
    if (unavailableReason !== null) return;
    onSubmit();
  };

  return (
    <div
      className="flex flex-col rounded-lg border border-input bg-background focus-within:border-iris-ring"
      onKeyDown={submitOnCmdEnter(submit)}
    >
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto px-2.5 py-2">
        {issue === null && references.length === 0 ? null : (
          <AttachedContextRow
            issue={issue}
            projectId={projectId}
            references={references}
            onRemove={(key) => onReferencesChange(removeContextReference(references, key))}
            label={label}
          />
        )}
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle p-1.5">
        <AddContextPopover
          projectId={projectId}
          repositoryId={target.repository.id}
          attachedKeys={new Set(references.map(contextReferenceKey))}
          onAdd={(reference) => onReferencesChange(addContextReference(references, reference))}
          label={label}
        />
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1.5">
          <BaseBranchControl target={target} disabled={pending} />
          <LaunchExecutionPicker execution={execution} onChange={onExecutionChange} label={label} />
        </div>
        <IconButton
          type="button"
          variant="primary"
          label={name}
          title={`${name} · ⌘↵`}
          icon={<Icon name="play" aria-hidden />}
          loading={pending}
          disabled={unavailableReason !== null}
          onClick={submit}
        />
      </div>
    </div>
  );
}
