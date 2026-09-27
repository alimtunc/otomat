import { FOCUS_RING, Icon, Skeleton } from "@otomat/ui";
import { usePullRequestStack } from "@web/api/prs/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { StackMemberItem } from "@web/components/pull-requests/stack-member";
import { CheckedAt } from "@web/components/shell/checked-at";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function PullRequestStackSection({ pullRequestId }: { pullRequestId: string }) {
  const query = usePullRequestStack(pullRequestId);
  return (
    <section aria-label="GitHub stack" className="space-y-3 border-t border-border-subtle pt-3">
      <QueryBoundary
        query={query}
        pending={<Skeleton height={32} />}
        error={
          <ErrorReport
            variant="inline"
            error={query.error}
            context="Stack membership unavailable"
            onRetry={() => void query.refetch()}
          />
        }
      >
        {(data) => (
          <>
            {data.stack === null ? (
              <div className="space-y-2">
                <p className="text-xs text-text-secondary">No stack declared on GitHub</p>
                <details className="text-xs text-text-tertiary">
                  <summary
                    className={`cursor-pointer rounded-sm py-1 hover:text-foreground ${FOCUS_RING}`}
                  >
                    Branch details
                  </summary>
                  <p className="mt-2 break-all font-mono">
                    {data.current.head_ref} → {data.current.base_ref}
                  </p>
                  <p className="mt-2">Branch targets alone do not confirm a stack.</p>
                </details>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Icon name="layers" size="sm" className="text-text-secondary" />
                    GitHub stack #{data.stack.number}
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    <span className="break-all font-mono text-text-secondary">
                      {data.stack.base_ref}
                    </span>{" "}
                    · Bottom to top
                  </p>
                </div>
                <ol className="m-0 list-none p-0">
                  {data.stack.members.map((member, index) => (
                    <StackMemberItem
                      key={member.number}
                      member={member}
                      index={index}
                      isCurrent={member.number === data.current.number}
                    />
                  ))}
                </ol>
              </div>
            )}
            <CheckedAt
              label="Refresh stack"
              checkedAt={data.checked_at}
              refreshing={query.isFetching}
              onRefresh={() => void query.refetch()}
            />
          </>
        )}
      </QueryBoundary>
    </section>
  );
}
