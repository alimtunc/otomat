import type { ProjectContract } from "@otomat/domain";
import type { IconName } from "@otomat/ui";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { NoProjectSelectedState } from "@web/components/shell/project-selection/no-project-selected-state";
import { selectableProjects } from "@web/components/shell/project-selection/selection";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { StaleNotice } from "@web/components/shell/stale-notice";
import type { ReactNode } from "react";

interface ProjectQueryBoundaryProps {
  query: {
    data: ProjectContract[] | undefined;
    dataUpdatedAt: number;
    error: unknown;
    isError: boolean;
    isFetching: boolean;
    refetch: () => void;
  };
  /** Given by a view that reads nothing without a project, which would otherwise wait on a query that never runs. */
  unselectedIcon?: IconName;
  children: ReactNode;
}

export function ProjectQueryBoundary({
  query,
  unselectedIcon,
  children,
}: ProjectQueryBoundaryProps) {
  const { settling } = useRemoteSession();
  if (
    unselectedIcon !== undefined &&
    query.data !== undefined &&
    selectableProjects(query.data).length === 0
  ) {
    return <NoProjectSelectedState icon={unselectedIcon} />;
  }
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
