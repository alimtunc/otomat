// @vitest-environment happy-dom
import type { IssueContract } from "@otomat/domain";
import { useProjectIssues } from "@web/api/issues/queries";
import { hostKeys } from "@web/api/query-keys";
import { activeHostStore } from "@web/lib/active-host";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { issueContract } from "#support/issue";
import { mountWithQuery } from "#support/mount";
import { testQueryClient } from "#support/query";

let calls = 0;
let gate = Promise.resolve();
let release: () => void = () => undefined;

/** Holds every daemon answer until `release`, so what is on screen meanwhile came from the cache. */
function hold(): void {
  gate = new Promise((resolve) => {
    release = resolve;
  });
}

vi.mock("@web/api/client", async () => {
  const { activeExecutionHostId } = await import("@web/lib/active-host");
  return {
    daemon: {
      listIssues: async ({ projectId }: { projectId: string }): Promise<IssueContract[]> => {
        calls += 1;
        const id = `${activeExecutionHostId()}:${projectId}#${calls}`;
        await gate;
        return [issueContract({ id })];
      },
    },
  };
});

function Probe({ projectId }: { projectId: string }) {
  const query = useProjectIssues(projectId);
  return <span>{query.data?.[0]?.id ?? "pending"}</span>;
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  release();
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  activeHostStore.setState(() => null);
  delete window.otomat;
  calls = 0;
});

/** Releases the held answers and waits for the screen to settle, bounded so a stall still fails. */
async function settleUntil(container: HTMLElement, done: (text: string) => boolean): Promise<void> {
  release();
  for (let i = 0; i < 40 && !done(container.textContent ?? ""); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

it("keeps every visited host+project renderable and never paints one under another", async () => {
  window.otomat = fakeDesktopBridge();
  const client = testQueryClient();
  const mounted = await mountWithQuery(<Probe projectId="a" />, client);
  cleanups.push(mounted.cleanup);
  expect(mounted.container.textContent).toBe("local:a#1");

  await mounted.rerender(<Probe projectId="b" />);
  await settleUntil(mounted.container, (text) => text === "local:b#2");
  expect(mounted.container.textContent).toBe("local:b#2");

  hold();
  await act(async () => {
    activeHostStore.actions.activate({ id: "remote", daemonUrl: "http://127.0.0.1:45010" });
  });
  expect(mounted.container.textContent).toBe("pending");
  await settleUntil(mounted.container, (text) => text.startsWith("remote:b#"));
  expect(mounted.container.textContent).toMatch(/^remote:b#\d+$/);

  await mounted.rerender(<Probe projectId="c" />);
  await settleUntil(mounted.container, (text) => text.startsWith("remote:c#"));
  expect(mounted.container.textContent).toMatch(/^remote:c#\d+$/);

  hold();
  await act(async () => {
    activeHostStore.actions.activate({ id: "local", daemonUrl: "http://127.0.0.1:5000" });
  });
  await mounted.rerender(<Probe projectId="a" />);
  expect(mounted.container.textContent).toBe("local:a#1");
  await settleUntil(mounted.container, (text) => text !== "local:a#1");
  expect(mounted.container.textContent).toMatch(/^local:a#[2-9]\d*$/);

  expect(client.getQueryData(hostKeys("local").issuesList("b"))).toBeDefined();
  expect(client.getQueryData(hostKeys("remote").issuesList("c"))).toBeDefined();
  expect(client.getQueryData(hostKeys("remote").issuesList("a"))).toBeUndefined();
});
