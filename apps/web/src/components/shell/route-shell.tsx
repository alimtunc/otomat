import {
  AppShell,
  Breadcrumbs,
  CommandPalette,
  ConnectionStatusIndicator,
  Icon,
  Topbar,
  useCommandPalette,
  useTheme,
  type BreadcrumbItem,
  type IconName,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { NewIssueDialog } from "@web/components/issues/new-issue-dialog";
import type { ShellSection } from "@web/components/shell/nav-items";
import { NewIssueContext } from "@web/components/shell/new-issue-context";
import { Sidebar } from "@web/components/shell/sidebar";
import { useNewIssueShortcut } from "@web/components/shell/use-new-issue-shortcut";
import { usePaletteGroups } from "@web/components/shell/use-palette-groups";
import { useShellData } from "@web/components/shell/use-shell-data";
import { FOCUS_RING } from "@web/lib/focus";
import { useCallback, useState, type ReactNode } from "react";

export interface RouteShellProps {
  breadcrumbs: BreadcrumbItem[];
  active: ShellSection;
  titleIcon?: IconName;
  titleNote?: string;
  breadcrumbExtra?: ReactNode;
  actions?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
}

export function RouteShell({
  breadcrumbs,
  active,
  titleIcon,
  titleNote,
  breadcrumbExtra,
  actions,
  rightPanel,
  children,
}: RouteShellProps) {
  const { density } = useTheme();
  const shell = useShellData();
  const palette = useCommandPalette();
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const openNewIssue = useCallback(() => setNewIssueOpen(true), []);
  const paletteGroups = usePaletteGroups({ onNewIssue: openNewIssue });
  useNewIssueShortcut(openNewIssue);

  const topbar = (
    <Topbar
      breadcrumbs={
        <span className="truncate text-sm text-text-secondary">{shell.projectLabel}</span>
      }
      onSearch={() => palette.setOpen(true)}
      connectionStatus={
        <ConnectionStatusIndicator
          state={shell.connectionState}
          lastSyncAt={shell.lastSyncAt}
          onRetry={shell.retry}
        />
      }
    />
  );

  const isTitle = breadcrumbs.length === 1;

  return (
    <AppShell
      density={density}
      connectionState={shell.connectionState}
      sidebar={
        <Sidebar
          active={active}
          online={shell.connectionState === "online"}
          daemonVersion={shell.daemonVersion}
          projects={shell.projects}
          currentProjectId={shell.currentProjectId}
          onProjectSelect={shell.selectProject}
          onSearch={() => palette.setOpen(true)}
          onNewIssue={openNewIssue}
          hasLiveRun={shell.hasLiveRun}
          reviewCount={shell.reviewCount}
        />
      }
      rightPanel={rightPanel}
      rightPanelAutoSaveId="otomat.cockpit"
      topbar={topbar}
    >
      <NewIssueContext.Provider value={openNewIssue}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-12 flex-none items-center gap-2.5 border-b border-border-subtle bg-background px-4.5">
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
                {titleNote ? <span className="text-xs text-text-tertiary">{titleNote}</span> : null}
              </>
            ) : (
              <Breadcrumbs
                items={breadcrumbs}
                renderLink={(item, label) => (
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
            <div className="flex-1" />
            {actions}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
      </NewIssueContext.Provider>
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} groups={paletteGroups} />
      <NewIssueDialog
        open={newIssueOpen}
        onOpenChange={setNewIssueOpen}
        projectId={shell.currentProjectId}
        projectName={shell.projectLabel}
      />
    </AppShell>
  );
}
