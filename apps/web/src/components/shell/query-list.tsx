import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

interface QueryListProps<T> {
  query: UseQueryResult<T[]>;
  pending: ReactNode;
  error: ReactNode;
  empty: ReactNode;
  children: (data: T[]) => ReactNode;
}

/** The pending → error → empty → items ladder every list boundary shares; slots keep each list's own markup. */
export function QueryList<T>({ query, pending, error, empty, children }: QueryListProps<T>) {
  if (query.isPending) return pending;
  if (query.isError) return error;
  if (query.data.length === 0) return empty;
  return children(query.data);
}
