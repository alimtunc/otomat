import { Icon } from "@otomat/ui";
import type { ConversationsQuery } from "@web/api/conversations/queries";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { StaleNotice } from "@web/components/shell/stale-notice";

export function ConversationsNotice({
  query,
  collapsed,
}: {
  query: ConversationsQuery;
  collapsed: boolean;
}) {
  const { settling } = useRemoteSession();
  if (!query.isError || (query.data === undefined && settling)) return null;
  let notice = (
    <StaleNotice
      dataUpdatedAt={query.dataUpdatedAt}
      refreshing={query.isFetching}
      onRetry={() => void query.refetch()}
    />
  );
  if (collapsed)
    notice = (
      <span
        role="status"
        aria-label="Conversations unavailable"
        title="Conversations unavailable"
        className="mx-auto flex h-8 items-center text-warning"
      >
        <Icon name="alert-triangle" className="size-4" aria-hidden />
      </span>
    );
  else if (query.data === undefined)
    notice = (
      <button
        type="button"
        className="mx-3 min-w-0 truncate text-left text-xs text-text-tertiary"
        onClick={() => void query.refetch()}
      >
        Conversations unavailable · Retry
      </button>
    );
  return <div className="flex min-h-8 min-w-0 items-center">{notice}</div>;
}
