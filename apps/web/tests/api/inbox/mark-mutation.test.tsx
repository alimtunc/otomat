// @vitest-environment happy-dom
import type { InboxSnapshot, MarkInboxRequest } from "@otomat/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMarkInbox } from "@web/api/inbox/mutations";
import { hostKeys } from "@web/api/query-keys";
import { afterEach, expect, it, vi } from "vitest";

import { inboxEntry } from "#support/inbox";
import { mount, type Mounted } from "#support/mount";

const keys = hostKeys("local");
const markInbox = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: { markInbox: (request: MarkInboxRequest) => markInbox(request) },
}));
vi.mock("@otomat/ui", async (importActual) => ({
  ...(await importActual<typeof import("@otomat/ui")>()),
  toast: { error: vi.fn() },
}));

const REQUEST: MarkInboxRequest = {
  marks: [
    {
      entry_id: "run:run-1",
      evidence_updated_at: "2026-08-22T10:00:00.000Z",
      read: false,
      archived: true,
    },
  ],
};

function ArchiveProbe() {
  const mark = useMarkInbox();
  return (
    <button type="button" onClick={() => mark.mutate(REQUEST)}>
      Archive
    </button>
  );
}

function loaded(): InboxSnapshot {
  return {
    entries: [inboxEntry(), inboxEntry({ id: "run:run-2" })],
    observed_at: "2026-08-22T10:00:00.000Z",
  };
}

const cleanups: Mounted["cleanup"][] = [];

async function mountProbe(client: QueryClient): Promise<HTMLElement> {
  const mounted = await mount(
    <QueryClientProvider client={client}>
      <ArchiveProbe />
    </QueryClientProvider>,
  );
  cleanups.push(mounted.cleanup);
  return mounted.container;
}

function archivedIds(client: QueryClient): string[] {
  const cached = client.getQueryData<InboxSnapshot>(keys.inbox);
  if (cached === undefined) throw new Error("inbox cache is not seeded");
  return cached.entries.filter((entry) => entry.archived).map((entry) => entry.id);
}

function clickArchive(container: HTMLElement): void {
  const button = container.querySelector("button");
  if (button === null) throw new Error("no archive button");
  button.click();
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  markInbox.mockReset();
});

it("applies the mark to the cached snapshot before the daemon answers", async () => {
  markInbox.mockReturnValue(new Promise<InboxSnapshot>(() => {}));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(keys.inbox, loaded());
  const container = await mountProbe(client);

  clickArchive(container);

  await vi.waitFor(() => expect(archivedIds(client)).toEqual(["run:run-1"]));
  expect(markInbox).toHaveBeenCalledWith(REQUEST);
});

it("seeds the snapshot the daemon answered and refetches behind it", async () => {
  const answered = loaded();
  answered.entries = answered.entries.map((entry) => ({ ...entry, archived: true }));
  markInbox.mockResolvedValue(answered);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  client.setQueryData(keys.inbox, loaded());
  const container = await mountProbe(client);

  clickArchive(container);

  await vi.waitFor(() => expect(archivedIds(client)).toEqual(["run:run-1", "run:run-2"]));
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: keys.inbox });
});

it("rolls the optimistic mark back when the daemon refuses", async () => {
  markInbox.mockRejectedValue(new Error("down"));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(keys.inbox, loaded());
  const container = await mountProbe(client);

  clickArchive(container);

  await vi.waitFor(() => expect(markInbox).toHaveBeenCalled());
  await vi.waitFor(() => expect(archivedIds(client)).toEqual([]));
});
