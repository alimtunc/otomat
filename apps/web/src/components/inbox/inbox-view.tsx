import { PlaceholderView } from "@web/components/shell/placeholder-view";

export function InboxView() {
  return (
    <PlaceholderView
      active="inbox"
      icon="inbox"
      label="Inbox"
      title="Nothing needs your attention"
      description="Permission requests, review-ready runs and reconciliations will queue here."
    />
  );
}
