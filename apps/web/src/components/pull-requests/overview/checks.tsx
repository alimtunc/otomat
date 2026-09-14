import type { PullRequestCheck } from "@otomat/domain";
import { Button, Collapsible, CollapsiblePanel, CollapsibleTrigger, Icon } from "@otomat/ui";
import { PullRequestCheckList } from "@web/components/pull-requests/overview/check-list";
import { OverviewSection } from "@web/components/pull-requests/overview/section";
import { useState } from "react";

export function PullRequestChecks({ checks }: { checks: PullRequestCheck[] }) {
  const passing = checks.filter((check) => check.state === "passing");
  const active = checks.filter((check) => check.state !== "passing");
  const [open, setOpen] = useState(false);
  return (
    <OverviewSection title="Checks">
      {checks.length === 0 ? (
        <p className="mt-2 text-sm text-text-tertiary">No check ran on this head.</p>
      ) : null}
      {active.length === 0 ? null : <PullRequestCheckList checks={active} />}
      {passing.length === 0 ? null : (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger render={<Button size="xs" variant="ghost" className="mt-2" />}>
            <Icon name={open ? "chevron-down" : "chevron-right"} />
            {passing.length} passing
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <PullRequestCheckList checks={passing} />
          </CollapsiblePanel>
        </Collapsible>
      )}
    </OverviewSection>
  );
}
