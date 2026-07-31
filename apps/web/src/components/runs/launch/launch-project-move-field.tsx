import type { IssueContract } from "@otomat/domain";
import {
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { useProjects, useRepositories } from "@web/api/daemon/queries";
import { moveIssueProjectErrorMessage, useMoveIssueProject } from "@web/api/issues/mutations";

export interface LaunchProjectMoveFieldProps {
  issue: IssueContract;
}

/**
 * Re-points the issue at a project that already has a usable repository. A
 * mirrored issue is not offered the move: its project comes from the tracker
 * connection and the next sync would revert it.
 */
export function LaunchProjectMoveField({ issue }: LaunchProjectMoveFieldProps) {
  const repositories = useRepositories();
  const projects = useProjects();
  const move = useMoveIssueProject(issue.id);
  const candidates = (repositories.data ?? []).filter(
    (repository) => repository.available && repository.project_id !== issue.project_id,
  );
  const projectName = (projectId: string, fallback: string) =>
    projects.data?.find((project) => project.id === projectId)?.name ?? fallback;

  if (issue.source !== "local") {
    return (
      <p className="text-xs text-text-tertiary">
        This {issue.source} issue stays in its synced project, so it needs a repository of its own.
      </p>
    );
  }
  if (repositories.isPending || projects.isPending) return null;
  if (repositories.isError) {
    return (
      <p role="alert" className="text-xs text-danger">
        Couldn’t load the other projects — moving this issue is unavailable.
      </p>
    );
  }
  if (candidates.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">
        No other project has a usable repository to move this issue to.
      </p>
    );
  }

  return (
    <Field>
      <FieldLabel>Run this issue in another project</FieldLabel>
      <Select
        items={candidates.map((repository) => ({
          value: repository.project_id,
          label: projectName(repository.project_id, repository.name),
        }))}
        value={null}
        onValueChange={(next) => {
          if (next !== null) move.mutate({ project_id: next });
        }}
      >
        <SelectTrigger aria-label="Move issue to project" disabled={move.isPending}>
          <SelectValue placeholder="Choose a project…" className="truncate" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((repository) => (
            <SelectItem key={repository.project_id} value={repository.project_id}>
              {projectName(repository.project_id, repository.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {move.isError ? (
        <p role="alert" className="text-xs text-danger">
          {moveIssueProjectErrorMessage(move.error)}
        </p>
      ) : null}
    </Field>
  );
}
