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
