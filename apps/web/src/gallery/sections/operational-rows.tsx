import { Chip, PRStatusBadge } from "@otomat/ui";
import { InboxGroup } from "@web/components/inbox/group";
import { InboxRow } from "@web/components/inbox/row";
import { useState } from "react";

import { Section } from "../section";

const MINUTE_MS = 60_000;
const at = (minutesAgo: number): string =>
  new Date(Date.now() - minutesAgo * MINUTE_MS).toISOString();

export function OperationalRowsSection() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Section title="Operational rows — type · id + title + reason · time · one action">
      <div className="flex w-full max-w-3xl flex-col">
        <InboxGroup label="Waiting on you" count={2}>
          <li>
            <InboxRow
              link={{ to: "/runs/$runId", params: { runId: "run-1" } }}
              leading={<Chip tone="warning">Permission requested</Chip>}
              identifier="OTO-140"
              title="Answer provider permission requests"
              reason="otomat · Step 2 of 3"
              time={at(4)}
              action="Grant or refuse the permission"
            />
          </li>
          <li>
            <InboxRow
              link={{ to: "/runs/$runId", params: { runId: "run-2" } }}
              leading={<Chip tone="danger">Run failed</Chip>}
              identifier="OTO-131"
              title="Keep CI on the critical path"
              reason="graphify · pnpm check failed"
              time={at(38)}
              action="Resume or abandon the run"
            />
          </li>
        </InboxGroup>
        <InboxGroup
          label="Needs your review"
          count={1}
          collapsed={collapsed}
          onToggle={() => setCollapsed((current) => !current)}
        >
          <li>
            <InboxRow
              link={{ to: "/pull-requests/$pullRequestId/diff", params: { pullRequestId: "pr-1" } }}
              leading={<PRStatusBadge status="open" />}
              identifier="otomat#183"
              title="feat(shell): open projects in tabs"
              reason="@superturk · OTO-139 · Project tabs"
              chips={
                <>
                  <Chip tone="success">Checks passing</Chip>
                  <Chip tone="neutral">Otomat</Chip>
                </>
              }
              time={at(12)}
              action="Review"
            />
          </li>
        </InboxGroup>
      </div>
    </Section>
  );
}
