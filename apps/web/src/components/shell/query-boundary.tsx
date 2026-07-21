import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  pending: ReactNode;
  error: ReactNode;
  children: (data: T) => ReactNode;
}

/** The pending → error → data ladder every single-value query boundary shares; `QueryList` is the list-shaped sibling. */
export function QueryBoundary<T>({ query, pending, error, children }: QueryBoundaryProps<T>) {
  if (query.isPending) return pending;
  if (query.isError) return error;
  return children(query.data);
}
