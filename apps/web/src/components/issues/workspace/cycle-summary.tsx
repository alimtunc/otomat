import type { RunContract } from "@otomat/domain";
import { Button, ErrorState, Icon, IconButton, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRunPullRequest } from "@web/api/prs/queries";
import { useRunDetail } from "@web/api/runs/queries";
import { NextActionCtaButton } from "@web/components/runs/next-action/cta";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { runNextAction } from "@web/lib/run/next-action";

export function CycleSummary({
  run,
  selectedStepId,
}: {
  run: RunContract;
  selectedStepId: string | null;
}) {
  const detail = useRunDetail(run.id);
  const pr = useRunPullRequest(run.id);
  return (
    <QueryBoundary
      query={detail}
      pending={<Skeleton height={32} />}
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load the cycle"
          onRetry={() => void detail.refetch()}
        />
      }
    >
      {(data) => {
        const action = runNextAction(data, pr.data);
        const pullRequest = pr.data?.pull_request;
        const githubLabel = `Open PR #${pullRequest?.number} on GitHub`;
        return (
          <section aria-label="Cycle summary" className="flex flex-wrap items-center gap-2">
            {action.cta ? (
              <NextActionCtaButton runId={run.id} cta={action.cta} size="sm" variant="primary" />
            ) : (
              <p className="text-xs text-text-secondary">{action.description}</p>
            )}
            {action.cta?.target.type === "diff" ? null : (
              <IconButton
                label="Review the run diff"
                icon={<Icon name="git-compare" aria-hidden />}
                nativeButton={false}
                role="link"
                render={
                  <Link
                    to="/runs/$runId/diff"
                    params={{ runId: run.id }}
                    search={{ step: selectedStepId ?? undefined }}
                  />
                }
              />
            )}
            {pullRequest?.url && action.cta?.target.type !== "external" ? (
              <IconButton
                label={githubLabel}
                icon={<Icon name="external-link" aria-hidden />}
                nativeButton={false}
                role="link"
                render={
                  <a
                    href={pullRequest.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={githubLabel}
                  />
                }
              />
            ) : null}
            {pr.isError ? (
              <Button variant="ghost" size="xs" onClick={() => void pr.refetch()}>
                Couldn’t refresh publication state — retry
              </Button>
            ) : null}
          </section>
        );
      }}
    </QueryBoundary>
  );
}
