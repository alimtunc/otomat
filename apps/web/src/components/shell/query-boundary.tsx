import type { UseQueryResult } from "@tanstack/react-query";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import type { ReactNode } from "react";

import { StaleNotice } from "./stale-notice";

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  pending: ReactNode;
  error: ReactNode;
  staleData?: "keep" | "block";
  children: (data: T) => ReactNode;
}

export function QueryBoundary<T>({
  query,
  pending,
  error,
  staleData = "keep",
  children,
}: QueryBoundaryProps<T>) {
  const { settling } = useRemoteSession();
  if (query.data === undefined) return query.isError && !settling ? error : pending;
  if (query.isError && staleData === "block") return error;
  return (
    <>
      {query.isError ? (
        <StaleNotice
          dataUpdatedAt={query.dataUpdatedAt}
          refreshing={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {children(query.data)}
    </>
  );
}
