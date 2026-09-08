import type { InboxSnapshot, MarkInboxRequest } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

function applyMarks(snapshot: InboxSnapshot, request: MarkInboxRequest): InboxSnapshot {
  const marks = new Map(request.marks.map((mark) => [mark.entry_id, mark]));
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) => {
      const mark = marks.get(entry.id);
      return mark === undefined ? entry : { ...entry, read: mark.read, archived: mark.archived };
    }),
  };
}

export function useMarkInbox() {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: MarkInboxRequest) => daemon.markInbox(request),
    onMutate: async (request) => {
      await client.cancelQueries({ queryKey: keys.inbox });
      const previous = client.getQueryData<InboxSnapshot>(keys.inbox);
      client.setQueryData<InboxSnapshot>(keys.inbox, (current) =>
        current === undefined ? current : applyMarks(current, request),
      );
      return { previous };
    },
    onSuccess: (snapshot) => client.setQueryData(keys.inbox, snapshot),
    onError: (_error, _request, context) => {
      if (context?.previous !== undefined) client.setQueryData(keys.inbox, context.previous);
      toast.error("Could not update the Inbox — is the daemon running?");
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.inbox }),
  });
}
