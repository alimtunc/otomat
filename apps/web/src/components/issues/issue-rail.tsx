import type { IssueContract, RunContract } from "@otomat/domain";
import { Button, Icon, IssueStatusChip, RunStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

function RailSection({
  title,
  last = false,
  children,
}: {
  title: ReactNode;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={last ? "pb-3.5 pt-1.5" : "mb-3.5 border-b border-border-subtle pb-3.5 pt-1.5"}>
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
        {title}
      </div>
      {children}
    </div>
  );
}

function RailMeta({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.25 text-sm">
      {children}
    </dl>
  );
}

function RailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="m-0 inline-flex min-w-0 items-center gap-1.5 justify-self-end text-foreground">
        {children}
      </dd>
    </>
  );
}

export function IssueRail({ issue, latestRun }: { issue: IssueContract; latestRun?: RunContract }) {
  return (
    <aside className="overflow-auto border-l border-border-subtle p-4">
      <RailSection title="Properties" last={!latestRun}>
        <RailMeta>
          <RailRow label="Status">
            <IssueStatusChip status={issue.status} />
          </RailRow>
          <RailRow label="Source">
            <span className="text-text-secondary">{issue.source}</span>
          </RailRow>
        </RailMeta>
      </RailSection>
      {latestRun ? (
        <RailSection
          title={
            <>
              Run
              <span className="font-normal text-text-tertiary">· {latestRun.id.slice(0, 8)}</span>
            </>
          }
          last
        >
          <RailMeta>
            <RailRow label="Status">
              <RunStatusChip status={latestRun.status} />
            </RailRow>
            <RailRow label="Branch">
              <span className="truncate font-mono text-xs text-text-secondary">
                {latestRun.branch}
              </span>
            </RailRow>
          </RailMeta>
          <Button
            size="sm"
            className="mt-2.5 w-full"
            render={
              <Link to="/runs/$runId" params={{ runId: latestRun.id }}>
                <Icon name="activity" aria-hidden />
                Open run cockpit
              </Link>
            }
          />
        </RailSection>
      ) : null}
    </aside>
  );
}
