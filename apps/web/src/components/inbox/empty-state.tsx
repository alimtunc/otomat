import { EmptyState } from "@otomat/ui";

export function InboxEmpty({ filtered }: { filtered: boolean }) {
  return filtered ? (
    <EmptyState
      icon="inbox"
      title="No entry matches these filters"
      description="Widen the state, type or project filter to see the rest of the Inbox."
    />
  ) : (
    <EmptyState
      icon="inbox"
      title="Nothing needs your attention"
      description="Blocked runs, permission requests, stopped publications and pull requests waiting on you queue here, across every project."
    />
  );
}
