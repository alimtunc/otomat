import { ErrorReport } from "@web/components/diagnostics/error-report";
import { QueryStaleNotice } from "@web/components/shell/query-stale-notice";
import type { ReactNode } from "react";

interface ProjectQueryBoundaryProps {
  query: {
    data: unknown;
    dataUpdatedAt: number;
    error: unknown;
    isError: boolean;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  };
  children: ReactNode;
}

/**
 * Centralizes project-query failures while leaving child loading and empty states intact. Once
 * projects have loaded, a failed refresh keeps the view under a stale notice instead of blanking
 * it with the error report.
 */
export function ProjectQueryBoundary({ query, children }: ProjectQueryBoundaryProps) {
  if (query.isError && query.data === undefined) {
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
        <QueryStaleNotice
          dataUpdatedAt={query.dataUpdatedAt}
          refreshing={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {children}
    </>
  );
}
