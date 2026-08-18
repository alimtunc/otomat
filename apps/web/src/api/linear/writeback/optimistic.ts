import type { LinearWritebackState } from "@otomat/domain";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";

import { reportUnlessHandled } from "./errors";

export function useOptimisticWriteback<TRequest>(
  issueId: string,
  apply: (current: LinearWritebackState, request: TRequest) => LinearWritebackState,
) {
  const client = useQueryClient();
  const key = queryKeys.linearWriteback(issueId);
  return {
    client,
    onMutate: async (request: TRequest) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<LinearWritebackState>(key);
      // Patching an unloaded cache would invent a writeback state the daemon never sent.
      if (previous !== undefined) client.setQueryData(key, apply(previous, request));
      return { previous };
    },
    onError: (
      error: unknown,
      _request: TRequest,
      context: { previous?: LinearWritebackState } | undefined,
    ) => {
      if (context?.previous !== undefined) client.setQueryData(key, context.previous);
      reportUnlessHandled(error);
    },
  };
}
