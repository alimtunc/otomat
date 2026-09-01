import {
  AppShell,
  type BreadcrumbItem,
  Breadcrumbs,
  CommandPalette,
  ConnectionStatusIndicator,
  FOCUS_RING,
  Icon,
  IconButton,
  type IconName,
  PageBar,
  useCommandPalette,
  useTheme,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import { ActivityCenter } from "@web/components/shell/activity/center";
import type { ShellSection } from "@web/components/shell/nav-items";
import { NewIssueContext } from "@web/components/shell/new-issue-context";
import { usePaletteGroups } from "@web/components/shell/palette/use-groups";
import { AddProjectDialog } from "@web/components/shell/project-selection/add-project-dialog";
import { ProjectTabsBar } from "@web/components/shell/project-tabs/bar";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { Sidebar } from "@web/components/shell/sidebar";
import type { BackNavigation } from "@web/components/shell/use-back-navigation";
import { useNewIssueShortcut } from "@web/components/shell/use-new-issue-shortcut";
import { useShellData } from "@web/components/shell/use-shell-data";
import { useCallback, useState, type ReactNode } from "react";

export interface RouteShellProps {
  breadcrumbs: BreadcrumbItem[];
  active: ShellSection;
  titleIcon?: IconName;
  titleNote?: string;
  back?: BackNavigation | null;
  breadcrumbExtra?: ReactNode;
  tabs?: ReactNode;
  actions?: ReactNode;
  /** Fixed row between the page header and the scrollable content. */
  banner?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
}

export function RouteShell({
  breadcrumbs,
  active,
  titleIcon,
  titleNote,
  back,
  breadcrumbExtra,
  tabs,
  actions,
  banner,
  rightPanel,
  children,
}: RouteShellProps) {
  const { density } = useTheme();
  const shell = useShellData();
  const remote = useRemoteSession();
  const palette = useCommandPalette();
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const openNewIssue = useCallback(() => setNewIssueOpen(true), []);
  const paletteGroups = usePaletteGroups({ search: palette.search, onNewIssue: openNewIssue });
  useNewIssueShortcut(openNewIssue);

  const isTitle = breadcrumbs.length === 1;

  const pageBar = (
    <PageBar
      leading={
        <>
          {back ? (
            <IconButton
              label={back.label}
              icon={<Icon name="arrow-left" aria-hidden />}
              onClick={back.goBack}
            />
          ) : null}
          {isTitle ? (
            <>
              <h1 className="flex items-center gap-2.25 text-md font-semibold text-foreground">
                {titleIcon ? (
                  <Icon
                    name={titleIcon}
                    aria-hidden
                    className="h-4.25 w-4.25 text-text-secondary"
                  />
                ) : null}
                {breadcrumbs[0]?.label}
              </h1>
              {titleNote ? (
                <span className="truncate text-xs text-text-tertiary">{titleNote}</span>
              ) : null}
            </>
          ) : (
            <Breadcrumbs
              items={breadcrumbs}
              renderLink={(item, label) => (
                // SAFETY: Breadcrumbs calls renderLink only for items carrying an href.
                <Link
                  to={item.href as string}
                  className={`truncate hover:text-foreground ${FOCUS_RING} focus-visible:rounded-sm`}
                >
                  {label}
                </Link>
              )}
            />
          )}
          {breadcrumbExtra}
        </>
      }
      tabs={tabs}
      trailing={
        <>
          {actions}
          <ActivityCenter hostLabel={shell.activeHostLabel} />
          <div className="flex items-center gap-1.5 px-1.5 text-xs">
            <ConnectionStatusIndicator
              state={shell.connectionState}
              lastSyncAt={shell.lastSyncAt}
              onRetry={shell.retry}
              note={
                remote.active && remote.alias !== null
                  ? `Runs execute on ${remote.alias}. Closing Otomat leaves them running there, and a daemon update waits for them to finish.`
                  : undefined
              }
            />
          </div>
        </>
      }
    />
  );

  return (
    <AppShell
      density={density}
      tabs={<ProjectTabsBar />}
      connectionState={shell.connectionState}
      {...(shell.connectionLabel === undefined ? {} : { connectionLabel: shell.connectionLabel })}
      sidebar={
        <Sidebar
          active={active}
          online={shell.connectionState === "online"}
          daemonVersion={shell.daemonVersion}
          hostAlias={shell.hostAlias ?? undefined}
          projects={shell.projects}
          currentProjectId={shell.currentSwitcherId}
          onProjectSelect={shell.selectProject}
          onAddProject={() => setAddProjectOpen(true)}
          onSearch={() => palette.setOpen(true)}
          onNewIssue={openNewIssue}
          hasLiveRun={shell.hasLiveRun}
          reviewCount={shell.reviewCount}
          inboxCount={shell.inboxCount}
        />
      }
      rightPanel={rightPanel}
      topbar={pageBar}
    >
      <NewIssueContext.Provider value={openNewIssue}>
        <div className="flex h-full min-h-0 flex-col">
          {banner}
          <div data-scroll-restoration-id="route-content" className="min-h-0 flex-1 overflow-auto">
            {children}
          </div>
        </div>
      </NewIssueContext.Provider>
      <CommandPalette
        open={palette.open}
        onOpenChange={palette.setOpen}
        search={palette.search}
        onSearchChange={palette.setSearch}
        groups={paletteGroups}
      />
      <NewIssueDialog
        open={newIssueOpen}
        onOpenChange={setNewIssueOpen}
        projectId={shell.currentProjectId}
        projectName={shell.projectLabel}
      />
      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        hosts={shell.hostOptions}
        onSelect={shell.selectProject}
      />
    </AppShell>
  );
}
