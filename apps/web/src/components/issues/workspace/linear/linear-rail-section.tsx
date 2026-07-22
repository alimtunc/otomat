import type { IssueContract, RunContract } from "@otomat/domain";
import { Button, Skeleton } from "@otomat/ui";
import { usePublishLinearPrLink } from "@web/api/linear/writeback";
import { useRunPullRequest } from "@web/api/prs/queries";
import { RailMeta, RailSection } from "@web/components/issues/workspace/rail/rail-primitives";

import { LabelsEditor } from "./labels-editor";
import { LinearPropertyRows } from "./linear-property-rows";
import { useLinearIssueEditing } from "./use-linear-issue-editing";
import { WriteHistory } from "./write-history";

function IdentifierLink({ issue }: { issue: IssueContract }) {
  if (issue.source_identifier === null) return null;
  const label = <span className="font-mono text-micro">{issue.source_identifier}</span>;
  if (issue.source_url === null) return <span className="text-text-tertiary">{label}</span>;
  return (
    <a
      className="text-text-tertiary underline decoration-border-subtle underline-offset-2 hover:text-text-secondary"
      href={issue.source_url}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
}

function PrAttachAction({ issueId, run }: { issueId: string; run: RunContract }) {
  const pr = useRunPullRequest(run.id);
  const publish = usePublishLinearPrLink(issueId);
  if (pr.isError) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        <span className="flex-1">The run's pull request could not be loaded.</span>
        <Button size="xs" variant="outline" onClick={() => void pr.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  const pullRequest = pr.data?.pull_request ?? null;
  if (pullRequest === null || pullRequest.url === null) return null;
  const url = pullRequest.url;
  const title = pullRequest.number === null ? "Pull request" : `PR #${pullRequest.number}`;
  return (
    <Button
      size="xs"
      variant="outline"
      className="w-full"
      loading={publish.isPending}
      onClick={() => publish.mutate({ url, title, run_id: run.id })}
    >
      Attach {title} to Linear
    </Button>
  );
}

export function LinearRailSection({
  issue,
  run,
}: {
  issue: IssueContract;
  run: RunContract | null;
}) {
  const editing = useLinearIssueEditing(issue.id);

  function body() {
    if (editing.editorOffline) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-text-tertiary">
            Linear is unreachable. Publishing needs the live issue; local edits stay safe.
          </p>
          <Button size="xs" variant="outline" className="self-start" onClick={editing.retryEditor}>
            Retry
          </Button>
        </div>
      );
    }
    if (editing.snapshot === null) return <Skeleton height={96} />;
    return (
      <>
        <RailMeta>
          <LinearPropertyRows editing={editing} issueId={issue.id} runId={run?.id ?? null} />
        </RailMeta>
        <LabelsEditor editing={editing} />
      </>
    );
  }

  return (
    <RailSection
      title={
        <>
          Linear
          <span className="flex-1" />
          <IdentifierLink issue={issue} />
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {body()}
        {run !== null ? <PrAttachAction issueId={issue.id} run={run} /> : null}
        {editing.writebackOffline ? (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span className="flex-1">Local draft and history could not be loaded.</span>
            <Button size="xs" variant="outline" onClick={editing.retryWriteback}>
              Retry
            </Button>
          </div>
        ) : (
          <WriteHistory issueId={issue.id} writes={editing.writes} />
        )}
      </div>
    </RailSection>
  );
}
