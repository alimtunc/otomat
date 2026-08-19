import { ErrorReport } from "@web/components/diagnostics/error-report";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { StaleNotice } from "@web/components/shell/stale-notice";
import type { ReactNode } from "react";

interface ProjectQueryBoundaryProps {
  query: {
    data: unknown;
    dataUpdatedAt: number;
    error: unknown;
    isError: boolean;
    isFetching: boolean;
    refetch: () => void;
  };
  children: ReactNode;
}

/**
 * Centralizes project-query failures while leaving child loading and empty states intact. Once
 * projects have loaded, a failed refresh keeps the view under a stale notice instead of blanking
 * it with the error report. A query that failed only because its host is still settling keeps the
 * children's own loading state: the shell already says what it is waiting for.
 */
export function ProjectQueryBoundary({ query, children }: ProjectQueryBoundaryProps) {
  const { settling } = useRemoteSession();
  if (query.isError && query.data === undefined) {
    if (settling) return <>{children}</>;
    return (
      <ErrorReport
        error={query.error}
        context="Couldn’t load projects"
        onRetry={() => void query.refetch()}
      />
    );
  }
  return (
    <>
      {query.isError ? (
        <StaleNotice
          dataUpdatedAt={query.dataUpdatedAt}
          refreshing={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {children}
    </>
  );
}
