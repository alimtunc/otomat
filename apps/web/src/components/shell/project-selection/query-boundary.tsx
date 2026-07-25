import { DaemonUnreachableState } from "@web/components/shell/daemon-unreachable-state";
import type { ReactNode } from "react";

interface ProjectQueryBoundaryProps {
  query: {
    isError: boolean;
    refetch: () => Promise<unknown>;
  };
  children: ReactNode;
}

/** Centralizes project-query failures while leaving child loading and empty states intact. */
export function ProjectQueryBoundary({ query, children }: ProjectQueryBoundaryProps) {
  if (query.isError) {
    return (
      <DaemonUnreachableState title="Couldn’t load projects" onRetry={() => void query.refetch()} />
    );
  }
  return children;
}
