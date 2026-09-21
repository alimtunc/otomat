import { useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";
import { useEffect } from "react";

/** Mounted by the Conversations view only: the list is live while it is read, and the badge polls the rest of the time. */
export function useConversationsStream(): void {
  const client = useQueryClient();
  const keys = useQueryKeys();

  // otomat-allow-effect: opens the active host's conversations stream and reopens it when the host changes.
  useEffect(() => {
    const subscription = daemon.subscribeConversations({
      onSnapshot: (snapshot) => client.setQueryData(keys.conversations, snapshot),
    });
    return () => subscription.close();
  }, [client, keys]);
}
