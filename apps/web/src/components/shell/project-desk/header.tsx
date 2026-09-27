import { FOCUS_RING_INSET, HostTag, Icon, IconButton, type ProjectSummary } from "@otomat/ui";
import { Link, useRouterState } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";

import { isDeskRoute } from "./state";

export function ProjectDeskHeader({
  project,
  hostLabel,
  onHome,
  onOrganize,
}: {
  project: ProjectSummary | undefined;
  hostLabel: string;
  onHome: () => void;
  onOrganize: () => void;
}) {
  const layout = useSelector(projectLayoutStore);
  const location = useRouterState({ select: (state) => state.location });
  const group = layout.groups.find((entry) => entry.projects.includes(project?.id ?? ""));
  const scoped = isDeskRoute(location.href) || location.pathname.startsWith("/settings/project");
  return (
    <header className="flex h-11 min-w-0 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface-1 px-3">
      {scoped ? (
        <button
          type="button"
          title={`All project features · ${project?.name ?? "Project"}`}
          onClick={onHome}
          className={`flex min-w-0 items-center gap-2 rounded px-1 py-1 text-sm ${FOCUS_RING_INSET}`}
        >
          {group ? (
            <span className="hidden max-w-40 truncate text-text-tertiary lg:block">
              {group.name} /
            </span>
          ) : null}
          <strong className="truncate font-medium">{project?.name ?? "Select a project"}</strong>
          <Icon name="chevron-right" className="size-3 shrink-0 text-text-tertiary" aria-hidden />
        </button>
      ) : (
        <span className="truncate text-xs text-text-secondary">All projects on {hostLabel}</span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Link to="/settings/host" title="Host connection">
          <HostTag tag={hostLabel} />
        </Link>
        <IconButton
          label="Organize projects"
          icon={<Icon name="sliders-horizontal" aria-hidden />}
          onClick={onOrganize}
        />
      </div>
    </header>
  );
}
