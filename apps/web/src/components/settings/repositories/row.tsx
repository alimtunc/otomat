import type { ExecutionHostId, RepositoryContract } from "@otomat/domain";
import {
  Button,
  Chip,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  toast,
} from "@otomat/ui";
import { useRemoveRepository } from "@web/components/settings/repositories/use-remove-repository";
import { useRef, useState } from "react";

export interface RepositoryRowProps {
  hostId: ExecutionHostId;
  repository: RepositoryContract;
}

export function RepositoryRow({ hostId, repository }: RepositoryRowProps) {
  const trigger = useRef<HTMLButtonElement>(null);
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
        {repository.available ? null : <Chip tone="danger">Path unavailable</Chip>}
        <DropdownMenu>
          <DropdownMenuTrigger
            ref={trigger}
            render={
              <IconButton
                size="sm"
                label={`Actions for ${repository.name}`}
                icon={<Icon name="more-horizontal" />}
              />
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent aria-label={`Remove ${repository.name}`} finalFocus={trigger}>
          <DialogHeader>
            <DialogTitle>Remove {repository.name}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-text-secondary">
              Deletes this repository’s Otomat record and runs on its host.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {error === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
