import { ErrorReport } from "@web/components/diagnostics/error-report";
import type { ReactNode } from "react";

interface ProjectQueryBoundaryProps {
  query: {
    isError: boolean;
    error: unknown;
    refetch: () => Promise<unknown>;
  };
  children: ReactNode;
}

/** Centralizes project-query failures while leaving child loading and empty states intact. */
export function ProjectQueryBoundary({ query, children }: ProjectQueryBoundaryProps) {
  if (query.isError) {
    return (
      <ErrorReport
        error={query.error}
        context="Couldn’t load projects"
        onRetry={() => void query.refetch()}
      />
    );
  }
  return children;
}
