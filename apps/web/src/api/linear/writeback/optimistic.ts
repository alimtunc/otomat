import type { LinearWritebackState } from "@otomat/domain";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";

import { reportUnlessHandled } from "./errors";

export function useOptimisticWriteback<TRequest>(
  issueId: string,
  apply: (current: LinearWritebackState | undefined, request: TRequest) => LinearWritebackState,
) {
  const client = useQueryClient();
  const key = queryKeys.linearWriteback(issueId);
  return {
    client,
    onMutate: async (request: TRequest) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<LinearWritebackState>(key);
      client.setQueryData<LinearWritebackState>(key, (current) => apply(current, request));
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
