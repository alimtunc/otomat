// @vitest-environment happy-dom
import {
  countUnreadConversations,
  type ConversationSnapshot,
  type MarkInboxRequest,
} from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { useMarkConversations } from "@web/api/conversations/mutations";
import { hostKeys } from "@web/api/query-keys";
import { markInboxRequest } from "@web/lib/inbox/marks";
import { expect, it, vi } from "vitest";

import { conversationEntry, crmConversationEntry } from "#support/conversations";
import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";
import { testQueryClient, withQueryClient } from "#support/query";

const keys = hostKeys("local");
const markInbox = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: { markInbox: (request: MarkInboxRequest) => markInbox(request) },
}));

const ENTRIES = [conversationEntry(), crmConversationEntry()];

function MarkAllProbe() {
  const mark = useMarkConversations();
  return (
    <button type="button" onClick={() => mark.mutate(markInboxRequest(ENTRIES, { read: true }))}>
      Mark all read
    </button>
  );
}

function cachedEntries(client: QueryClient): ConversationSnapshot["entries"] {
  const cached = client.getQueryData<ConversationSnapshot>(keys.conversations);
  if (cached === undefined) throw new Error("conversations cache is not seeded");
  return cached.entries;
}

it("empties the unread count every badge reads before the daemon answers, archiving nothing", async () => {
  markInbox.mockReturnValue(new Promise(() => {}));
  const client = testQueryClient();
  client.setQueryData<ConversationSnapshot>(keys.conversations, {
    entries: ENTRIES,
    observed_at: "2026-09-29T10:00:00.000Z",
  });
  const { cleanup } = await mount(withQueryClient(<MarkAllProbe />, client));
  const button = findButton("Mark all read");
  if (button === undefined) throw new Error("no mark all read button");

  button.click();

  await vi.waitFor(() => expect(countUnreadConversations(cachedEntries(client))).toBe(0));
  expect(cachedEntries(client).map((entry) => entry.archived)).toEqual([false, false]);
  expect(markInbox).toHaveBeenCalledOnce();
  await cleanup();
});
