// @vitest-environment happy-dom
import { TerminalConversationBody } from "@web/components/conversations/terminal-body";
import { afterEach, expect, it, vi } from "vitest";

import { terminalConversationEntry } from "#support/conversations";
import { fakeDesktopBridge } from "#support/desktop-bridge";
import { mountWithQuery } from "#support/mount";

let input: (data: string) => void;
const writes: string[] = [];
let options: { disableStdin: boolean };
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    options: { disableStdin: boolean };
    constructor(value: { disableStdin: boolean }) {
      this.options = value;
      options = value;
    }
    open() {}
    loadAddon() {}
    focus() {}
    dispose() {}
    onResize() {
      return { dispose: () => undefined };
    }
    onData(callback: typeof input) {
      input = callback;
      return { dispose: () => undefined };
    }
    write(data: string, done: () => void) {
      writes.push(data);
      done();
    }
  },
}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
  },
}));
vi.mock("@web/components/diagnostics/error-report", () => ({
  ErrorReport: ({ context }: { context: string }) => <div>{context}</div>,
}));
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  delete window.otomat;
  vi.unstubAllGlobals();
  writes.length = 0;
});

it("replays a saved terminal read-only without spawning or sending input", async () => {
  window.otomat = fakeDesktopBridge();
  const session = terminalConversationEntry().terminal;
  const methods: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    methods.push(init?.method ?? "GET");
    return Response.json(
      url.includes("/output")
        ? { session, data: "saved terminal output", cursor: 1, truncated: false }
        : { instance: "00000000-0000-4000-8000-000000000001", sessions: [] },
    );
  });
  const mounted = await mountWithQuery(<TerminalConversationBody session={session} />);
  cleanup = mounted.cleanup;
  await vi.waitFor(() => expect(writes).toContain("saved terminal output"));
  expect(options.disableStdin).toBe(true);
  input("echo should-not-run\r");
  expect(methods.every((method) => method === "GET")).toBe(true);
  await vi.waitFor(() => expect(mounted.container.textContent).toContain("Session ended"));
});

it("points to the desktop app when no desktop connection exists", async () => {
  const session = terminalConversationEntry().terminal;
  const mounted = await mountWithQuery(<TerminalConversationBody session={session} />);
  cleanup = mounted.cleanup;
  expect(mounted.container.textContent).toContain("available in the desktop app");
});
