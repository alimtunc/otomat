import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { StaleNotice } from "./stale-notice";

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  pending: ReactNode;
  error: ReactNode;
  /** "block" prefers the error slot over retained data, for controls that must not act on stale state. */
  staleData?: "keep" | "block";
  children: (data: T) => ReactNode;
}

/**
 * The pending → error → data ladder every single-value query boundary shares; `QueryList` is the
 * list-shaped sibling. Data retained from a previous fetch outlives a failed refresh: it renders
 * under a stale notice with Retry instead of the blocking error slot.
 */
export function QueryBoundary<T>({
  query,
  pending,
  error,
  staleData = "keep",
  children,
}: QueryBoundaryProps<T>) {
  if (query.data === undefined) return query.isError ? error : pending;
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
