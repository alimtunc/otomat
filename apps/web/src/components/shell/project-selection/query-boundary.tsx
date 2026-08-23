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
