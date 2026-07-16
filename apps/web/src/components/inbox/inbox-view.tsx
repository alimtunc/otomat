import { EmptyState } from "@otomat/ui";
import { CenteredState } from "@web/components/shell/centered-state";
import { RouteShell } from "@web/components/shell/route-shell";

export function InboxView() {
  return (
    <RouteShell active="inbox" titleIcon="inbox" breadcrumbs={[{ label: "Inbox", current: true }]}>
      <CenteredState>
        <EmptyState
          icon="inbox"
          title="Nothing needs your attention"
          description="Permission requests, review-ready runs and reconciliations will queue here."
        />
      </CenteredState>
    </RouteShell>
  );
}
