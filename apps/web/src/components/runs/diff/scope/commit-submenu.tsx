import type { RunDiffScope, RunDiffScopeSelector } from "@otomat/domain";
import {
  ConfigMenuChoice,
  ConfigMenuNote,
  ConfigMenuProblem,
  ConfigMenuSubmenu,
  DropdownMenuRadioGroup,
} from "@otomat/ui";
import { useRunCommits } from "@web/api/runs/queries";

export interface DiffCommitSubmenuProps {
  runId: string;
  scope: RunDiffScope;
  open: boolean;
  onSelect: (selector: RunDiffScopeSelector) => void;
}

export function DiffCommitSubmenu({ runId, scope, open, onSelect }: DiffCommitSubmenuProps) {
  const commits = useRunCommits(runId, open);
  const listed = commits.data?.commits ?? [];

  return (
    <ConfigMenuSubmenu label="Commit" value={scope.kind === "commit" ? scope.short_sha : "none"}>
      {commits.isError ? (
        <ConfigMenuProblem
          message="The branch commits could not be read."
          onRetry={() => void commits.refetch()}
        />
      ) : null}
      {commits.isPending ? <ConfigMenuNote>Reading the branch commits…</ConfigMenuNote> : null}
      {commits.data?.unavailable ? (
        <ConfigMenuNote>{commits.data.unavailable}</ConfigMenuNote>
      ) : null}
      {commits.data !== undefined && listed.length === 0 && commits.data.unavailable === null ? (
        <ConfigMenuNote>This branch carries no commit above its fork point yet.</ConfigMenuNote>
      ) : null}
      <DropdownMenuRadioGroup
        value={scope.kind === "commit" ? scope.commit : ""}
        onValueChange={(next) => onSelect({ kind: "commit", commit: String(next) })}
      >
        {listed.map((commit) => (
          <ConfigMenuChoice
            key={commit.sha}
            value={commit.sha}
            label={commit.subject}
            hint={commit.short_sha}
            description={`${commit.author_name} · ${new Date(commit.authored_at).toLocaleString()}`}
          />
        ))}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
