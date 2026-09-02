import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useRefreshPullRequest } from "@web/api/prs/mutations";
import { useQueryKeys } from "@web/api/use-query-keys";
import { pullRequestImportRefusal } from "@web/lib/pull-request/import-error";
import { useCallback, useEffect } from "react";

const UNREACHABLE = "GitHub could not be read for this pull request.";

export interface PullRequestReconciliation {
  running: boolean;
  failure: string | null;
  retry: () => void;
}

export function usePullRequestReconciliation(
  pullRequestId: string,
  issueId: string | null,
): PullRequestReconciliation {
  const keys = useQueryKeys();
  const client = useQueryClient();
  const refresh = useRefreshPullRequest(pullRequestId, issueId);
  const running = useIsMutating({ mutationKey: keys.pullRequestRefresh(pullRequestId) }) > 0;
  const { mutate } = refresh;

  // A `running` dependency would re-arm the arrival effect the moment the pass it started settles.
  const start = useCallback(
    (announce: boolean) => {
      if (client.isMutating({ mutationKey: keys.pullRequestRefresh(pullRequestId) }) > 0) return;
      mutate({ announce });
    },
    [client, keys, mutate, pullRequestId],
  );

  // otomat-allow-effect: arriving on a pull request is what asks GitHub for a fresher mirror.
  useEffect(() => {
    start(false);
  }, [start]);

  const failure =
    refresh.error === null ? null : (pullRequestImportRefusal(refresh.error) ?? UNREACHABLE);

  return { running, failure, retry: () => start(true) };
}
