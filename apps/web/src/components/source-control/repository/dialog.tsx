import {
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Spinner,
} from "@otomat/ui";
import { useRepositoryBranches } from "@web/api/daemon/queries";
import {
  useGenerateRepositoryPullRequest,
  usePublishRepositoryPullRequest,
} from "@web/api/prs/mutations";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { RepositoryPullRequestForm } from "@web/components/source-control/repository/form";

export interface RepositoryPullRequestDialogProps {
  repositoryId: string;
  branch: string;
  revision: string;
  onClose: () => void;
}

export function RepositoryPullRequestDialog({
  repositoryId,
  branch,
  revision,
  onClose,
}: RepositoryPullRequestDialogProps) {
  const branches = useRepositoryBranches(repositoryId);
  const publish = usePublishRepositoryPullRequest(repositoryId);
  const generate = useGenerateRepositoryPullRequest(repositoryId);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Publish project commits</DialogTitle>
        <DialogDescription>
          Publish commits from {branch}. Generate the PR or customize its details. Uncommitted files
          stay local.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <QueryBoundary
          query={branches}
          pending={
            <CenteredState fill="flex">
              <Spinner label="Loading branches" />
            </CenteredState>
          }
          error={
            <ErrorState
              title="Could not load the repository branches"
              onRetry={() => void branches.refetch()}
            />
          }
        >
          {(data) => (
            <RepositoryPullRequestForm
              repositoryId={repositoryId}
              branches={data.branches}
              defaultBranch={data.default_branch}
              revision={revision}
              publish={publish}
              generate={generate}
              onPublished={onClose}
            />
          )}
        </QueryBoundary>
      </DialogBody>
    </DialogContent>
  );
}
