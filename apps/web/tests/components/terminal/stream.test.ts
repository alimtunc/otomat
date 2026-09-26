// @vitest-environment happy-dom
import { createDaemonClient } from "@otomat/client";
import type { TerminalSession } from "@otomat/domain";
import { attachTerminalStream } from "@web/components/terminal/stream";
import { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { TERMINAL_INSTANCE as instance, terminalSession } from "#support/terminal";

const session = terminalSession();
const cleanups: Array<() => void> = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers();
});

function resized(cols: number, rows: number) {
  return { path: `/api/terminals/${session.id}/resize`, body: { instance, cols, rows } };
}

function output(cursor: number, data: string, state: TerminalSession["state"] = "running") {
  return Response.json({
    session: { ...session, state, exit_code: state === "exited" ? 0 : null },
    cursor,
    truncated: false,
    data,
  });
}

function attachOverTunnel() {
  const polls: Array<(result: Response | Error) => void> = [];
  const reads: string[] = [];
  const posts: Array<{ path: string; body: unknown }> = [];
  const client = createDaemonClient({
    baseUrl: "http://127.0.0.1:52000",
    token: "remote-token",
    fetch: async (url, init) => {
      const target = new URL(url instanceof Request ? url.url : url);
      if (init?.method === "POST") {
        posts.push({ path: target.pathname, body: JSON.parse(String(init.body)) });
        return Response.json({});
      }
      reads.push(target.searchParams.get("after") ?? "");
      return new Promise<Response>((resolve, reject) => {
        polls.push((result) => (result instanceof Error ? reject(result) : resolve(result)));
      });
    },
  });
  const terminal = new Terminal({ cols: 80, rows: 24, disableStdin: true });
  const notices: string[] = [];
  const detach = attachTerminalStream(terminal, { client, instance, id: session.id }, (notice) =>
    notices.push(notice),
  );
  cleanups.push(() => {
    detach();
    terminal.dispose();
  });
  const answer = async (result: Response | Error): Promise<void> => {
    await vi.waitFor(() => expect(polls).toHaveLength(1));
    polls.shift()?.(result);
  };
  return { terminal, polls, reads, posts, notices, answer };
}

it("sends the size on connect, then forwards input and resizes", async () => {
  const { terminal, posts, answer } = attachOverTunnel();
  await answer(output(1, "remote$ "));
  await vi.waitFor(() => expect(posts).toEqual([resized(80, 24)]));
  expect(terminal.options.disableStdin).toBe(false);
  terminal.input("pwd");
  terminal.resize(100, 40);
  await vi.waitFor(() => expect(posts).toHaveLength(3));
  expect(posts).toContainEqual({
    path: `/api/terminals/${session.id}/input`,
    body: { instance, data: "pwd" },
  });
  expect(posts).toContainEqual(resized(100, 40));
});

it("reattaches after the host drops, resends the current size and sends nothing typed meanwhile", async () => {
  const { terminal, reads, posts, notices, answer } = attachOverTunnel();
  await answer(output(1, "remote$ "));
  await vi.waitFor(() => expect(posts).toHaveLength(1));
  terminal.resize(100, 40);
  await answer(new TypeError("tunnel closed"));
  await vi.waitFor(() => expect(notices.at(-1)).toMatch(/^Disconnected: .*still be running/));
  expect(terminal.options.disableStdin).toBe(true);
  terminal.input("lost");
  await vi.advanceTimersByTimeAsync(2000);
  await answer(output(2, "back"));
  await vi.waitFor(() =>
    expect(posts).toEqual([resized(80, 24), resized(100, 40), resized(100, 40)]),
  );
  expect(terminal.options.disableStdin).toBe(false);
  expect(reads).toEqual(["0", "1", "1"]);
});

it("stops polling once the session exits", async () => {
  const { terminal, polls, notices, answer } = attachOverTunnel();
  await answer(output(1, "remote$ "));
  await answer(output(1, "", "exited"));
  await vi.waitFor(() => expect(notices.at(-1)).toBe("Session ended · exit 0"));
  expect(terminal.options.disableStdin).toBe(true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(polls).toHaveLength(0);
});
