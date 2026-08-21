import type { ExecutionHostId, RepositoryContract } from "@otomat/domain";
import { Button, Chip, toast } from "@otomat/ui";
import { useRemoveRepository } from "@web/components/settings/repositories/use-remove-repository";
import { useState } from "react";

export interface RepositoryRowProps {
  hostId: ExecutionHostId;
  repository: RepositoryContract;
}

export function RepositoryRow({ hostId, repository }: RepositoryRowProps) {
  const remove = useRemoveRepository();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-foreground">{repository.name}</span>
          <span className="truncate font-mono text-xs text-text-tertiary">
            {repository.root_path}
          </span>
        </div>
        <span className="shrink-0 font-mono text-xs text-text-tertiary">
          {repository.default_branch}
        </span>
        <Chip tone={repository.available ? "success" : "danger"}>
          {repository.available ? "Available" : "Path unavailable"}
        </Chip>
        {confirming ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="destructive"
              size="xs"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { hostId, repositoryId: repository.id },
                  {
                    onSuccess: () => toast.success(`${repository.name} removed`),
                    onError: (failure) => {
                      setError(failure.message);
                      setConfirming(false);
                    },
                  },
                )
              }
            >
              Delete repository and runs
            </Button>
            <Button autoFocus variant="ghost" size="xs" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
          >
            Remove
          </Button>
        )}
      </div>
      {error === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
