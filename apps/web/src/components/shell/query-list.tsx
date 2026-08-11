import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { QueryStaleNotice } from "./query-stale-notice";

interface QueryListProps<T> {
  query: UseQueryResult<T[]>;
  pending: ReactNode;
  error: ReactNode;
  empty: ReactNode;
  children: (data: T[]) => ReactNode;
}

/**
 * The pending → error → empty → items ladder every list boundary shares; slots keep each list's
 * own markup. Items retained from a previous fetch outlive a failed refresh: they render under a
 * stale notice with Retry instead of the blocking error slot.
 */
export function QueryList<T>({ query, pending, error, empty, children }: QueryListProps<T>) {
  if (query.data === undefined) return query.isError ? error : pending;
  return (
    <>
      {query.isError ? (
        <QueryStaleNotice
          dataUpdatedAt={query.dataUpdatedAt}
          refreshing={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data.length === 0 ? empty : children(query.data)}
    </>
  );
}
