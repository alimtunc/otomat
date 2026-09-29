import { isConversationFollowed } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { useMarkConversations } from "@web/api/conversations/mutations";
import { conversationsOptions } from "@web/api/conversations/queries";
import { useQueryKeys } from "@web/api/use-query-keys";
import {
  findConversationThread,
  type ConversationThreadTarget,
} from "@web/lib/conversations/find-thread";
import { markInboxRequest } from "@web/lib/inbox/marks";
import { useEffect, useRef } from "react";

export function useMarkConversationSeen(thread: ConversationThreadTarget | null): void {
  const keys = useQueryKeys();
  const { data: entry } = useQuery({
    ...conversationsOptions(keys),
    select: (snapshot) =>
      thread === null ? undefined : findConversationThread(snapshot.entries, thread),
  });
  const { mutate } = useMarkConversations();
  const seen = useRef<string | null>(null);
  const key = entry === undefined ? null : `${entry.id}:${entry.updated_at}`;

  // otomat-allow-effect: being on screen is the reading; no operator event expresses it, and visibility is a document fact.
  useEffect(() => {
    if (entry === undefined || key === null || seen.current === key) return;
    // A finished thread projects as read whatever its mark says; marking it keeps a reopened cycle from bringing it back.
    if (entry.read && isConversationFollowed(entry)) return;
    const markSeen = (): void => {
      if (document.visibilityState !== "visible" || seen.current === key) return;
      seen.current = key;
      mutate(markInboxRequest([entry], { read: true }));
    };
    markSeen();
    document.addEventListener("visibilitychange", markSeen);
    return () => document.removeEventListener("visibilitychange", markSeen);
  }, [entry, key, mutate]);
}
