import { Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { useProjectIssues } from "@web/api/issues/queries";
import { useProjectLinearSync } from "@web/api/linear/use-project-sync";
import { IssuesContent } from "@web/components/issues/list/content";
import { IssuesToolbar } from "@web/components/issues/list/toolbar";
import { useIssuesLayout } from "@web/components/issues/list/use-issues-layout";
import { useIssuesView } from "@web/components/issues/list/use-issues-view";
import { IssueViewControls } from "@web/components/issues/views/controls";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { RouteShell } from "@web/components/shell/route-shell";
import { asMember } from "@web/lib/coerce";
import { ISSUES_LAYOUTS } from "@web/lib/issue/layout";
import { visibleIssueGroups } from "@web/lib/issue/visible-groups";
import { useEffect } from "react";

export function IssuesView() {
  const selectedProject = useSelectedProject();
  const issues = useProjectIssues(selectedProject.projectId);
  const sync = useProjectLinearSync(selectedProject.projectId);
  const view = useIssuesView(selectedProject.projectId);
  const { layout, select: selectLayout } = useIssuesLayout(selectedProject.projectId);
  const { config } = view;
  const projectNames = new Map(
    (selectedProject.projects.data ?? []).map((project) => [project.id, project.name]),
  );

  const { refreshIfStale } = sync;
  // otomat-allow-effect: fires on entry and each sync-status change; the staleness guard bounds it.
  useEffect(() => {
    refreshIfStale();
  }, [refreshIfStale]);

  return (
    <RouteShell
      active="issues"
      titleIcon="list-todo"
      breadcrumbs={[{ label: "Issues", current: true }]}
      breadcrumbExtra={
        <IssueViewControls
          views={view.views}
          active={view.active}
          config={config}
          dirty={view.dirty}
          onOpenView={view.openView}
          onReset={view.reset}
        />
      }
      tabs={
        <SegmentedControl
          type="single"
          value={layout}
          onValueChange={(value) => {
            const next = asMember(value, ISSUES_LAYOUTS);
            if (next !== null) selectLayout(next);
          }}
          aria-label="Issues layout"
        >
          <SegmentedItem value="board" icon={<Icon name="columns-3" className="max-lg:hidden" />}>
            Board
          </SegmentedItem>
          <SegmentedItem value="list" icon={<Icon name="list" className="max-lg:hidden" />}>
            List
          </SegmentedItem>
        </SegmentedControl>
      }
      actions={
        <IssuesToolbar
          config={config}
          issues={issues.data ?? []}
          projectNames={projectNames}
          sync={sync}
          dirty={view.dirty}
          onChange={view.refine}
          onReset={view.reset}
        />
      }
    >
      <ProjectQueryBoundary query={selectedProject.projects}>
        <IssuesContent
          query={issues}
          groups={(items) => visibleIssueGroups(items, config, projectNames)}
          layout={layout}
          showGroupHeadings={config.grouping !== "none"}
          collapsed={config.collapsedGroups}
          onToggleGroup={view.toggleGroup}
        />
      </ProjectQueryBoundary>
    </RouteShell>
  );
}
