import {
  ConfigMenu,
  ConfigMenuChoice,
  ConfigMenuContent,
  ConfigMenuTrigger,
  DropdownMenuRadioGroup,
  Skeleton,
} from "@otomat/ui";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";

export interface BaseBranchControlProps {
  target: ReadyLaunchTarget;
  disabled?: boolean;
}

const WORKTREE_HELP =
  "The daemon creates a dedicated worktree and branch from here; your own checkout is never touched.";

/** Compact by default: forking from the repository's own default branch is not a decision, so it does not read like one. */
export function BaseBranchControl({ target, disabled = false }: BaseBranchControlProps) {
  if (target.branchesPending) return <Skeleton className="h-6.5 w-28" />;

  return (
    <>
      <ConfigMenu>
        <ConfigMenuTrigger
          label="Base branch"
          summary={target.baseBranch}
          detail={WORKTREE_HELP}
          disabled={disabled || target.branches.length === 0}
        />
        <ConfigMenuContent aria-label="Base branch">
          <DropdownMenuRadioGroup
            value={target.baseBranch}
            onValueChange={(next) => target.setBaseBranch(String(next))}
          >
            {target.branches.map((branch) => (
              <ConfigMenuChoice key={branch} value={branch} label={branch} />
            ))}
          </DropdownMenuRadioGroup>
        </ConfigMenuContent>
      </ConfigMenu>
      {/* Inline, not in the trigger's tooltip: the failure disables that trigger, and a disabled button never opens one. */}
      {target.branchesFailed ? (
        <p role="alert" className="text-xs text-danger">
          Could not read this repository's branches.
        </p>
      ) : null}
    </>
  );
}
