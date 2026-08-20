import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useRefreshPullRequest } from "@web/api/prs/mutations";
import { queryKeys } from "@web/api/query-keys";
import { pullRequestImportRefusal } from "@web/lib/pull-request/import-error";
import { useCallback, useEffect } from "react";

const UNREACHABLE = "GitHub could not be read for this pull request.";

export interface PullRequestReconciliation {
  running: boolean;
  /** The daemon's own refusal when the pass failed; the reviewer shows it beside Retry. */
  failure: string | null;
  retry: () => void;
}

/** Arriving reconciles the pull request, so the first usable state never waits on a click. */
export function usePullRequestReconciliation(
  pullRequestId: string,
  issueId: string | null,
): PullRequestReconciliation {
  const client = useQueryClient();
  const refresh = useRefreshPullRequest(pullRequestId, issueId);
  const running = useIsMutating({ mutationKey: queryKeys.pullRequestRefresh(pullRequestId) }) > 0;
  const { mutate } = refresh;

  // Reading the pass imperatively keeps `start` stable: a `running` dependency would re-arm the
  // arrival effect the moment the pass it started settles.
  const start = useCallback(
    (announce: boolean) => {
      if (client.isMutating({ mutationKey: queryKeys.pullRequestRefresh(pullRequestId) }) > 0)
        return;
      mutate({ announce });
    },
    [client, mutate, pullRequestId],
  );

  // otomat-allow-effect: arriving on a pull request is what asks GitHub for a fresher mirror.
  useEffect(() => {
    start(false);
  }, [start]);

  const failure =
    refresh.error === null ? null : (pullRequestImportRefusal(refresh.error) ?? UNREACHABLE);

  return { running, failure, retry: () => start(true) };
}
