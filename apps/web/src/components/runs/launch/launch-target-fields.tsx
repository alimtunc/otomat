import {
  Field,
  FieldControl,
  FieldLabel,
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@otomat/ui";
import type { LaunchTargetState } from "@web/components/runs/launch/use-launch-target";

export interface LaunchTargetFieldsProps {
  /** Only the ready state renders: a blocked target is handled by the dialog, not by a disabled field. */
  target: Extract<LaunchTargetState, { status: "ready" }>;
  disabled?: boolean;
}

/** Where the run will work: the repository it forks from, and the branch it forks at. */
export function LaunchTargetFields({ target, disabled = false }: LaunchTargetFieldsProps) {
  const items = target.branches.map((branch) => ({ value: branch, label: branch }));
  const picker =
    items.length === 0 ? (
      <p className="text-sm text-text-secondary">
        {target.branchesFailed
          ? `Could not read this repository's branches — forking from ${target.baseBranch}.`
          : `Forking from ${target.baseBranch}.`}
      </p>
    ) : (
      <FieldControl>
        <Select
          items={items}
          value={target.baseBranch}
          onValueChange={(next) => {
            if (next !== null) target.setBaseBranch(next);
          }}
        >
          <SelectTrigger aria-label="Base branch" disabled={disabled}>
            <SelectValue className="truncate" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldControl>
    );

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel>Repository</FieldLabel>
        <p className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Icon name="folder-git-2" aria-hidden className="h-3.5 w-3.5 text-text-tertiary" />
          <span className="truncate">{target.repository.name}</span>
        </p>
      </Field>
      <Field>
        <FieldLabel>Base branch</FieldLabel>
        {target.branchesPending ? <Skeleton className="h-9 w-full" /> : picker}
      </Field>
      <p className="text-xs text-text-tertiary">
        The daemon creates a dedicated worktree and branch from here; your own checkout is never
        touched.
      </p>
    </div>
  );
}
