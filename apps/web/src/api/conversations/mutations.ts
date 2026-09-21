import type { ConversationSnapshot, MarkInboxRequest } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";
import { applyInboxMarks } from "@web/lib/inbox/marks";

/** The marks route answers with the Inbox, so the conversations cache is patched optimistically and re-read on settle. */
export function useMarkConversations() {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: MarkInboxRequest) => daemon.markInbox(request),
    onMutate: async (request) => {
      await client.cancelQueries({ queryKey: keys.conversations });
      const previous = client.getQueryData<ConversationSnapshot>(keys.conversations);
      client.setQueryData<ConversationSnapshot>(keys.conversations, (current) =>
        current === undefined ? current : applyInboxMarks(current, request),
      );
      return { previous };
    },
    onError: (_error, _request, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(keys.conversations, context.previous);
      }
      toast.error("Could not update the conversation — is the daemon running?");
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.conversations }),
  });
}
