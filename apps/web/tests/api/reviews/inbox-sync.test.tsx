// @vitest-environment happy-dom
import type { PullRequestInbox } from "@otomat/domain";
import { hostKeys } from "@web/api/query-keys";
import { usePullRequestInboxSync } from "@web/api/reviews/use-inbox-sync";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { mountWithQuery } from "#support/mount";
import { testQueryClient } from "#support/query";

const mocks = vi.hoisted(() => ({ getPullRequestInbox: vi.fn(), syncPullRequestInbox: vi.fn() }));
vi.mock("@web/api/client", () => ({ daemon: mocks }));

function Probe() {
  const sync = usePullRequestInboxSync("p1");
  return <span>{sync.repositories ?? "loading"}</span>;
}

it("waits for freshness, skips a running pass, and refreshes an idle stale inbox", async () => {
  mocks.getPullRequestInbox.mockReturnValue(new Promise(() => undefined));
  const inbox: PullRequestInbox = {
    project_id: "p1",
    viewer: { login: null, teams_known: true },
    entries: [],
    sync: {
      running: false,
      repositories: 1,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    },
  };
  mocks.syncPullRequestInbox.mockResolvedValue(inbox);
  const client = testQueryClient();
  const view = await mountWithQuery(<Probe />, client);
  try {
    expect(mocks.syncPullRequestInbox).not.toHaveBeenCalled();
    for (const sync of [inbox.sync, { ...inbox.sync, running: true, last_synced_at: null }]) {
      await act(async () => {
        client.setQueryData(hostKeys("local").pullRequestInbox("p1"), { ...inbox, sync });
      });
      await view.rerender(<Probe />);
      expect(mocks.syncPullRequestInbox).not.toHaveBeenCalled();
    }
    await act(async () => {
      client.setQueryData(hostKeys("local").pullRequestInbox("p1"), {
        ...inbox,
        sync: { ...inbox.sync, last_synced_at: null },
      });
    });
    await view.rerender(<Probe />);
    await vi.waitFor(() =>
      expect(mocks.syncPullRequestInbox).toHaveBeenCalledExactlyOnceWith("p1"),
    );
  } finally {
    await view.cleanup();
  }
});
