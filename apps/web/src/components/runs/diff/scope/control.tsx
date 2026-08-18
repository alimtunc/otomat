import type { RunDiffScope, RunDiffScopeSelector } from "@otomat/domain";
import {
  ConfigMenu,
  ConfigMenuChoice,
  ConfigMenuContent,
  ConfigMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
} from "@otomat/ui";
import { DiffCommitSubmenu } from "@web/components/runs/diff/scope/commit-submenu";
import { diffScopeDetail, diffScopeSummary } from "@web/components/runs/diff/scope/label";
import { DiffPassSubmenu } from "@web/components/runs/diff/scope/pass-submenu";
import type { RunPass } from "@web/lib/run/passes";
import { useState } from "react";

export interface DiffScopeControlProps {
  runId: string;
  /** What the daemon answered for, so the control always reflects the diff on screen. */
  scope: RunDiffScope;
  passes: readonly RunPass[];
  onSelect: (selector: RunDiffScopeSelector) => void;
}

/** The reviewer's one statement of what it is showing, and the only place that changes it. */
export function DiffScopeControl({ runId, scope, passes, onSelect }: DiffScopeControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <ConfigMenu open={open} onOpenChange={setOpen}>
      <ConfigMenuTrigger
        label="Diff scope"
        summary={diffScopeSummary(scope)}
        detail={diffScopeDetail(scope)}
        size="xs"
      />
      <ConfigMenuContent align="start" aria-label="Diff scope">
        <DropdownMenuRadioGroup
          value={scope.kind === "workspace" ? "workspace" : ""}
          onValueChange={() => onSelect({ kind: "workspace" })}
        >
          <ConfigMenuChoice
            value="workspace"
            label="Workspace"
            description="Everything the branch carries against its fork point."
          />
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DiffCommitSubmenu runId={runId} scope={scope} open={open} onSelect={onSelect} />
        <DiffPassSubmenu scope={scope} passes={passes} onSelect={onSelect} />
      </ConfigMenuContent>
    </ConfigMenu>
  );
}
