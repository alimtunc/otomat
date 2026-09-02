// @vitest-environment happy-dom
import { countOpenInboxEntriesByProject, type InboxSnapshot } from "@otomat/domain";
import { hostKeys } from "@web/api/query-keys";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { useOpenHostInboxes } from "@web/components/shell/project-tabs/use-open-host-inboxes";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { inboxEntry } from "#support/inbox";
import { mountWithQuery, type Mounted } from "#support/mount";
import { testQueryClient } from "#support/query";

const OBSERVED_AT = "2026-08-22T10:00:00.000Z";

vi.mock("@web/api/client", () => ({
  daemon: {
    listInbox: async (): Promise<InboxSnapshot> => ({
      entries: [inboxEntry({ id: "run:l1", project: { id: "p1", name: "Otomat" } })],
      observed_at: OBSERVED_AT,
    }),
  },
}));

const remoteInbox = vi.fn<() => InboxSnapshot>(() => ({ entries: [], observed_at: OBSERVED_AT }));

function Probe() {
  const inboxes = useOpenHostInboxes();
  return (
    <ul>
      {inboxes.map(({ host, entries }) => (
        <li key={host}>
          {host}:
          {[...countOpenInboxEntriesByProject(entries)]
            .map(([projectId, count]) => `${projectId}=${count}`)
            .join(",")}
        </li>
      ))}
    </ul>
  );
}

const mounted: Mounted[] = [];

beforeEach(() => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.readInbox = () =>
    Promise.resolve({ ok: true as const, value: remoteInbox() });
  window.otomat = bridge;
  projectTabsStore.setState(() => [
    { key: "local:p1", route: null },
    { key: "remote:p9", route: null },
  ]);
});

afterEach(async () => {
  for (const instance of mounted.splice(0)) await instance.cleanup();
  document.body.replaceChildren();
  window.localStorage.clear();
  remoteInbox.mockReset();
  remoteInbox.mockReturnValue({ entries: [], observed_at: OBSERVED_AT });
  delete window.otomat;
});

function rows(): string[] {
  return [...document.body.querySelectorAll("li")].map((row) => row.textContent ?? "");
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

it("polls the Inbox of every host with an open tab, the focused one and the others alike", async () => {
  remoteInbox.mockReturnValue({
    entries: [inboxEntry({ id: "run:r1", project: { id: "p9", name: "Far" } })],
    observed_at: OBSERVED_AT,
  });

  mounted.push(await mountWithQuery(<Probe />));

  expect(rows()).toEqual(["local:p1=1", "remote:p9=1"]);
});

it("badges a run that turns review-ready on the host that is not focused", async () => {
  const client = testQueryClient();
  mounted.push(await mountWithQuery(<Probe />, client));
  expect(rows()).toEqual(["local:p1=1", "remote:"]);

  remoteInbox.mockReturnValue({
    entries: [
      inboxEntry({ id: "run:r1", kind: "run_review_ready", project: { id: "p9", name: "Far" } }),
    ],
    observed_at: OBSERVED_AT,
  });
  await act(async () => {
    await client.refetchQueries({ queryKey: hostKeys("remote").inbox });
  });
  await flush();

  expect(rows()).toEqual(["local:p1=1", "remote:p9=1"]);
});

it("stops polling a host once its last tab closes, and keeps what it had until it is collected", async () => {
  const client = testQueryClient();
  mounted.push(await mountWithQuery(<Probe />, client));
  const remoteKey = hostKeys("remote").inbox;
  expect(client.getQueryCache().find({ queryKey: remoteKey })?.getObserversCount()).toBe(1);

  await act(async () => {
    projectTabsStore.actions.close("remote:p9");
  });

  expect(rows()).toEqual(["local:p1=1"]);
  expect(client.getQueryCache().find({ queryKey: remoteKey })?.getObserversCount()).toBe(0);
  expect(client.getQueryData(remoteKey)).toBeDefined();
});
