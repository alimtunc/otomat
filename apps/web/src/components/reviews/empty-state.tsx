import type { PullRequestInbox } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";

export interface ReviewInboxEmptyProps {
  inbox: PullRequestInbox;
  /** True when entries exist but the active filters hide all of them. */
  filtered: boolean;
}

export function ReviewInboxEmpty({ inbox, filtered }: ReviewInboxEmptyProps) {
  if (inbox.viewer.login === null) {
    return (
      <EmptyState
        icon="git-pull-request"
        title="GitHub is not connected"
        description="Sign in to GitHub in Settings; the inbox groups pull requests around the account Otomat signs in as."
      />
    );
  }
  if (inbox.sync.repositories === 0) {
    return (
      <EmptyState
        icon="git-pull-request"
        title="No repository to reconcile"
        description="Register this project's repository in Settings, and its open pull requests land here."
      />
    );
  }
  return (
    <EmptyState
      icon="git-pull-request"
      title={filtered ? "No pull request matches these filters" : "Nothing is waiting for you"}
      description={
        filtered
          ? "Clear a filter to see the rest of the inbox."
          : "Open pull requests that want your review, or need work of yours, appear here."
      }
    />
  );
}
