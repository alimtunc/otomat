import type { RepositoryContract } from "@otomat/domain";
import { Button, toast } from "@otomat/ui";
import { deleteRepositoryErrorMessage, useDeleteRepository } from "@web/api/repositories/mutations";
import { useState } from "react";

export function RepositoryRow({ repository }: { repository: RepositoryContract }) {
  const remove = useDeleteRepository();
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{repository.name}</span>
      <span className="font-mono text-xs text-text-tertiary">{repository.default_branch}</span>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="destructive"
            size="xs"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(repository.id, {
                onSuccess: () => toast.success(`${repository.name} removed`),
                onError: (error) => {
                  toast.error(deleteRepositoryErrorMessage(error));
                  setConfirming(false);
                },
              })
            }
          >
            Delete repository and runs
          </Button>
          <Button autoFocus variant="ghost" size="xs" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="xs" onClick={() => setConfirming(true)}>
          Remove
        </Button>
      )}
    </li>
  );
}
