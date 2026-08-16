import type { UseQueryResult } from "@tanstack/react-query";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import type { ReactNode } from "react";

import { StaleNotice } from "./stale-notice";

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
 * stale notice with Retry instead of the blocking error slot. A list that failed only because its
 * host is still settling stays pending: the shell already says what it is waiting for.
 */
export function QueryList<T>({ query, pending, error, empty, children }: QueryListProps<T>) {
  const { settling } = useRemoteSession();
  if (query.data === undefined) return query.isError && !settling ? error : pending;
  return (
    <>
      {query.isError ? (
        <StaleNotice
          dataUpdatedAt={query.dataUpdatedAt}
          refreshing={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data.length === 0 ? empty : children(query.data)}
    </>
  );
}
