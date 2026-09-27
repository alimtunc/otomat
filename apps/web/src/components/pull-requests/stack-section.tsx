import {
  cn,
  FOCUS_RING,
  Icon,
  IconButton,
  PRStatusBadge,
  RelativeTime,
  Skeleton,
} from "@otomat/ui";
import { usePullRequestStack } from "@web/api/prs/use-stack";
import { ErrorReport } from "@web/components/diagnostics/error-report";
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
                  {data.stack.members.map((member, index) => {
                    const isCurrent = member.number === data.current.number;
                    return (
                      <li
                        key={member.number}
                        className="relative pb-3 pl-7 before:absolute before:bottom-0 before:left-2.5 before:top-5 before:w-px before:bg-border-subtle last:pb-0 last:before:hidden"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "absolute left-0 top-1 flex size-5 items-center justify-center rounded-full border text-micro tabular-nums",
                            isCurrent
                              ? "border-border-strong bg-surface-3 font-medium text-foreground"
                              : "border-border-subtle bg-surface-2 text-text-tertiary",
                          )}
                        >
                          {index + 1}
                        </span>
                        <div
                          className={cn(
                            "rounded-md border p-2",
                            isCurrent
                              ? "border-border-strong bg-surface-3"
                              : "border-transparent bg-surface-1",
                          )}
                        >
                          <a
                            href={member.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-current={isCurrent ? "true" : undefined}
                            className={`group block rounded-sm hover:text-foreground ${FOCUS_RING}`}
                          >
                            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                              <span className="font-mono">#{member.number}</span>
                              {isCurrent ? (
                                <span className="font-medium text-foreground">Current PR</span>
                              ) : null}
                              <Icon
                                name="external-link"
                                size="xs"
                                className="ml-auto text-text-tertiary group-hover:text-foreground"
                              />
                            </span>
                            <span className="mt-1.5 block break-words text-xs leading-relaxed">
                              {member.title}
                            </span>
                          </a>
                          <div className="mt-2">
                            <PRStatusBadge status={member.status} />
                          </div>
                          <details className="mt-1 text-xs text-text-tertiary">
                            <summary
                              className={`cursor-pointer rounded-sm py-1 hover:text-foreground ${FOCUS_RING}`}
                            >
                              Branches
                            </summary>
                            <p className="mt-1 break-all font-mono leading-relaxed">
                              {member.head_ref} → {member.base_ref}
                            </p>
                          </details>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-tertiary">
                Checked <RelativeTime date={data.checked_at} />
              </span>
              <IconButton
                size="sm"
                label="Refresh stack"
                icon={<Icon name="refresh-cw" size="xs" />}
                loading={query.isFetching}
                onClick={() => void query.refetch()}
              />
            </div>
          </>
        )}
      </QueryBoundary>
    </section>
  );
}
