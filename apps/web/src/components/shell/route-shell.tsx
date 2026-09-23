import {
  AppShellMain,
  type BreadcrumbItem,
  Breadcrumbs,
  ConnectionStatusIndicator,
  FOCUS_RING,
  Icon,
  IconButton,
  type IconName,
  PageBar,
} from "@otomat/ui";
import { Link, useRouterState } from "@tanstack/react-router";
import { ActivityCenter } from "@web/components/shell/activity/center";
import { recordPaletteVisit } from "@web/components/shell/palette/history";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import type { BackNavigation } from "@web/components/shell/use-back-navigation";
import { useShellData } from "@web/components/shell/use-shell-data";
import { useEffect, type ReactNode } from "react";

export interface RouteShellProps {
  breadcrumbs: BreadcrumbItem[];
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
  const shell = useShellData();
  const remote = useRemoteSession();
  const href = useRouterState({ select: (state) => state.location.href });
  const scope = shell.currentSwitcherId;
  const visitLabel = breadcrumbs.map((entry) => entry.label).join(" · ");
  // otomat-allow-effect: record visited routes for the palette after navigation commits.
  useEffect(() => {
    if (scope !== undefined) recordPaletteVisit(scope, { href, label: visitLabel });
  }, [scope, href, visitLabel]);
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
    <AppShellMain
      pageBar={pageBar}
      rightPanel={rightPanel}
      connectionState={shell.connectionState}
      {...(shell.connectionLabel === undefined ? {} : { connectionLabel: shell.connectionLabel })}
    >
      <div className="flex h-full min-h-0 flex-col">
        {banner}
        <div data-scroll-restoration-id="route-content" className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </AppShellMain>
  );
}
