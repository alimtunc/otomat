import type { PullRequestMergeMethod, PullRequestOverview } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MetaList,
} from "@otomat/ui";
import { useMergePullRequest } from "@web/api/prs/mutations";
import { MERGE_METHOD_LABEL } from "@web/lib/pull-request/merge-method-label";

const METHOD_CONSEQUENCE = {
  merge: "GitHub creates a merge commit; every commit of the branch stays in the history.",
  squash: "GitHub squashes the branch into one commit on the base.",
} satisfies Record<PullRequestMergeMethod, string>;

export interface PullRequestMergeDialogProps {
  overview: PullRequestOverview;
  method: PullRequestMergeMethod;
  onOpenChange: (open: boolean) => void;
}

export function PullRequestMergeDialog({
  overview,
  method,
  onOpenChange,
}: PullRequestMergeDialogProps) {
  const pullRequest = overview.pull_request;
  const merge = useMergePullRequest(pullRequest.id, pullRequest.issue_id);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent aria-label="Confirm the merge">
        <DialogHeader>
          <DialogTitle>
            {MERGE_METHOD_LABEL[method]} #{pullRequest.number ?? ""}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <MetaList
            items={[
              {
                key: "head",
                label: "Head",
                value: (
                  <span className="font-mono text-xs">{pullRequest.head_ref ?? "unknown"}</span>
                ),
              },
              {
                key: "base",
                label: "Base",
                value: (
                  <span className="font-mono text-xs">{pullRequest.base_ref ?? "unknown"}</span>
                ),
              },
            ]}
          />
          <p className="text-xs text-text-tertiary">
            {METHOD_CONSEQUENCE[method]}{" "}
            {pullRequest.issue_id === null
              ? null
              : "Otomat then closes this issue’s cycle and cleans its workspace if that is its policy. "}
            This cannot be undone from here.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Keep it open
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={merge.isPending}
            onClick={() => {
              merge.mutate({ method }, { onSuccess: () => onOpenChange(false) });
            }}
          >
            {MERGE_METHOD_LABEL[method]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
