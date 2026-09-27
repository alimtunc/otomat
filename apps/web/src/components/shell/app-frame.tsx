import { AppShell, CommandPalette, useCommandPalette, useTheme } from "@otomat/ui";
import { useRouterState } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { QuickOpen } from "@web/components/files/quick-open";
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import { sectionForPath } from "@web/components/shell/nav-items";
import { usePaletteGroups } from "@web/components/shell/palette/use-groups";
import { DeskTabsBar } from "@web/components/shell/project-desk/bar";
import { ProjectDeskHeader } from "@web/components/shell/project-desk/header";
import { useDeskSync } from "@web/components/shell/project-desk/use-sync";
import { arrangeProjects } from "@web/components/shell/project-layout/arrange";
import { OrganizeProjectsDialog } from "@web/components/shell/project-layout/organize-dialog";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";
import { AddProjectDialog } from "@web/components/shell/project-selection/add-project-dialog";
import { useOpenHostInboxes } from "@web/components/shell/project-tabs/use-open-host-inboxes";
import { useProjectTabShortcuts } from "@web/components/shell/project-tabs/use-tab-shortcuts";
import { Sidebar } from "@web/components/shell/sidebar";
import { StaleNotice } from "@web/components/shell/stale-notice";
import { useNewIssueShortcut } from "@web/components/shell/use-new-issue-shortcut";
import { useShellData } from "@web/components/shell/use-shell-data";
import { useCallback, useRef, useState, type ReactNode } from "react";

export function AppFrame({ children }: { children: ReactNode }) {
  const { density } = useTheme();
  const shell = useShellData();
  const palette = useCommandPalette();
  const deskRoute = useDeskSync();
  const inboxes = useOpenHostInboxes();
  const layout = useSelector(projectLayoutStore);
  useProjectTabShortcuts(
    arrangeProjects(layout, shell.projects).flatMap((section) => section.items),
    shell.currentSwitcherId,
    shell.selectProject,
  );
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const projectTrigger = useRef<HTMLButtonElement>(null);
  const openNewIssue = useCallback(() => setNewIssueOpen(true), []);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const paletteGroups = usePaletteGroups({
    search: palette.search,
    open: palette.open,
    onNewIssue: openNewIssue,
    scope: shell.currentSwitcherId,
  });
  useNewIssueShortcut(openNewIssue);

  let conversationNotice: ReactNode;
  if (shell.conversations.isError) {
    conversationNotice = (
      <button
        type="button"
        className="mx-3 min-w-0 truncate text-left text-xs text-text-tertiary"
        onClick={() => void shell.conversations.refetch()}
      >
        Conversations unavailable · Retry
      </button>
    );
    if (shell.conversations.data !== undefined)
      conversationNotice = (
        <StaleNotice
          dataUpdatedAt={shell.conversations.dataUpdatedAt}
          refreshing={shell.conversations.isFetching}
          onRetry={() => void shell.conversations.refetch()}
        />
      );
  }

  return (
    <AppShell
      density={density}
      tabs={
        <>
          <ProjectDeskHeader
            project={shell.projects.find((project) => project.id === shell.currentSwitcherId)}
            hostLabel={shell.activeHostLabel}
            onHome={() => {
              if (shell.currentSwitcherId) shell.selectProject(shell.currentSwitcherId, "/project");
            }}
            onOrganize={() => setOrganizeOpen(true)}
          />
          {shell.currentSwitcherId ? (
            <DeskTabsBar key={shell.currentSwitcherId} projectKey={shell.currentSwitcherId} />
          ) : null}
        </>
      }
      sidebar={
        <Sidebar
          active={sectionForPath(pathname)}
          projectTriggerRef={projectTrigger}
          projects={shell.projects}
          currentProjectId={shell.currentSwitcherId}
          onProjectSelect={shell.selectProject}
          onAddProject={() => setAddProjectOpen(true)}
          onOrganizeProjects={() => setOrganizeOpen(true)}
          onSearch={() => palette.setOpen(true)}
          onNewIssue={openNewIssue}
          hostId={deskRoute.host}
          hostLabel={shell.activeHostLabel}
          href={deskRoute.href}
          conversations={shell.conversations.data?.entries ?? []}
          inboxes={inboxes}
          notice={conversationNotice}
          inboxCount={shell.inboxCount}
          conversationCount={shell.conversationCount}
        />
      }
    >
      {children}
      <CommandPalette
        open={palette.open}
        onOpenChange={palette.setOpen}
        search={palette.search}
        onSearchChange={palette.setSearch}
        groups={paletteGroups}
      />
      <QuickOpen projectId={shell.currentProjectId} />
      <NewIssueDialog
        open={newIssueOpen}
        onOpenChange={setNewIssueOpen}
        projectId={shell.currentProjectId}
        projectName={shell.projectLabel}
      />
      <AddProjectDialog
        open={addProjectOpen}
        finalFocus={projectTrigger}
        onOpenChange={setAddProjectOpen}
        hosts={shell.hostOptions}
        onSelect={shell.selectProject}
      />
      <OrganizeProjectsDialog
        open={organizeOpen}
        onOpenChange={setOrganizeOpen}
        finalFocus={projectTrigger}
        projects={shell.projects}
      />
    </AppShell>
  );
}
