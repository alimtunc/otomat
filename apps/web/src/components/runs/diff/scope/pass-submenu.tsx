import type { RunDiffScope, RunDiffScopeSelector } from "@otomat/domain";
import { isPassReconstructable } from "@otomat/domain";
import {
  ConfigMenuChoice,
  ConfigMenuNote,
  ConfigMenuSubmenu,
  DropdownMenuRadioGroup,
} from "@otomat/ui";
import { passChoiceLabel } from "@web/components/runs/diff/scope/label";
import type { RunPass } from "@web/lib/run/passes";

export interface DiffPassSubmenuProps {
  scope: RunDiffScope;
  passes: readonly RunPass[];
  onSelect: (selector: RunDiffScopeSelector) => void;
}

export function DiffPassSubmenu({ scope, passes, onSelect }: DiffPassSubmenuProps) {
  // Ordinals come from the unfiltered index: a lost boundary must not renumber the other passes.
  const choices = passes.flatMap((pass, index) =>
    isPassReconstructable(pass.session.boundary) ? [{ pass, ordinal: index + 1 }] : [],
  );

  return (
    <ConfigMenuSubmenu label="Pass" value={scope.kind === "session" ? scope.step_name : "none"}>
      {choices.length === 0 ? (
        <ConfigMenuNote>
          No pass of this run has both git boundaries captured, so none has a delta to show.
        </ConfigMenuNote>
      ) : null}
      <DropdownMenuRadioGroup
        value={scope.kind === "session" ? scope.agent_session_id : ""}
        onValueChange={(next) => onSelect({ kind: "session", session: String(next) })}
      >
        {choices.map(({ pass, ordinal }) => (
          <ConfigMenuChoice
            key={pass.session.id}
            value={pass.session.id}
            label={passChoiceLabel(pass.stepName, ordinal)}
            hint={pass.session.id.slice(0, 8)}
          />
        ))}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
