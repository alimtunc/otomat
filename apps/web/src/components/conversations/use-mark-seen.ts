import type {
  ConversationThreadEntry as ConversationEntry,
  MarkInboxRequest,
} from "@otomat/domain";
import { markInboxRequest } from "@web/lib/inbox/marks";
import { useEffect, useRef } from "react";

/** Reading happens once per thread state: a thread that speaks again while open is read again, one in a hidden tab is not. */
export function useMarkConversationSeen(
  entry: ConversationEntry | undefined,
  mark: (request: MarkInboxRequest) => void,
): void {
  const seen = useRef<string | null>(null);
  const key = entry === undefined ? null : `${entry.id}:${entry.updated_at}`;

  // otomat-allow-effect: being on screen is the reading; no operator event expresses it, and visibility is a document fact.
  useEffect(() => {
    if (entry === undefined || key === null || entry.read || seen.current === key) return;
    const markSeen = (): void => {
      if (document.visibilityState !== "visible" || seen.current === key) return;
      seen.current = key;
      mark(markInboxRequest([entry], { read: true }));
    };
    markSeen();
    document.addEventListener("visibilitychange", markSeen);
    return () => document.removeEventListener("visibilitychange", markSeen);
  }, [entry, key, mark]);
}
