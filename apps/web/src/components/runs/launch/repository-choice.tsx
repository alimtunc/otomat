import { Button, EmptyState } from "@otomat/ui";
import type { LaunchTargetState } from "@web/components/runs/launch/use-launch-target";

export interface RepositoryChoiceProps {
  target: Extract<LaunchTargetState, { status: "ambiguous" }>;
}

export function RepositoryChoice({ target }: RepositoryChoiceProps) {
  return (
    <EmptyState
      variant="compact"
      icon="folder-git-2"
      title="Which repository should this run work in?"
      description="This project resolves several available repositories, so the worktree cannot be picked for you."
      action={
        <div className="flex flex-wrap gap-1.5">
          {target.repositories.map((repository) => (
            <Button
              key={repository.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => target.choose(repository.id)}
            >
              {repository.name}
            </Button>
          ))}
        </div>
      }
    />
  );
}
