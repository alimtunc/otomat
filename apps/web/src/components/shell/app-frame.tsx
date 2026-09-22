import { AppShell, CommandPalette, useCommandPalette, useTheme } from "@otomat/ui";
import { useRouterState } from "@tanstack/react-router";
import { QuickOpen } from "@web/components/files/quick-open";
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import { sectionForPath } from "@web/components/shell/nav-items";
import { usePaletteGroups } from "@web/components/shell/palette/use-groups";
import { AddProjectDialog } from "@web/components/shell/project-selection/add-project-dialog";
import { ProjectTabsBar } from "@web/components/shell/project-tabs/bar";
import { Sidebar } from "@web/components/shell/sidebar";
import { useNewIssueShortcut } from "@web/components/shell/use-new-issue-shortcut";
import { useShellData } from "@web/components/shell/use-shell-data";
import { useCallback, useRef, useState, type ReactNode } from "react";

/** Rendered once by the root route, so navigating swaps only the route's `AppShellMain`. */
export function AppFrame({ children }: { children: ReactNode }) {
  const { density } = useTheme();
  const shell = useShellData();
  const palette = useCommandPalette();
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
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

  return (
    <AppShell
      density={density}
      tabs={<ProjectTabsBar />}
      sidebar={
        <Sidebar
          active={sectionForPath(pathname)}
          projectTriggerRef={projectTrigger}
          projects={shell.projects}
          currentProjectId={shell.currentSwitcherId}
          onProjectSelect={shell.selectProject}
          onAddProject={() => setAddProjectOpen(true)}
          onSearch={() => palette.setOpen(true)}
          onNewIssue={openNewIssue}
          hasLiveRun={shell.hasLiveRun}
          reviewCount={shell.reviewCount}
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
    </AppShell>
  );
}
