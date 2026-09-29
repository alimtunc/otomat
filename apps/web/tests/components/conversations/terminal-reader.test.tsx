// @vitest-environment happy-dom
import type { TerminalSession } from "@otomat/domain";
import { TerminalReader } from "@web/components/conversations/terminal-reader";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";
import { TERMINAL_INSTANCE, terminalSession } from "#support/terminal";

vi.mock("@web/components/terminal/screen", () => ({ TerminalScreen: () => <div>PTY screen</div> }));
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  delete window.otomat;
  vi.unstubAllGlobals();
});

function dialogButton(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    (button) => button.textContent?.trim() === text,
  );
}

async function mountReader(session: TerminalSession, close: () => Promise<Response>) {
  window.otomat = fakeDesktopBridge();
  let owned = session;
  const closes: Array<{ path: string; body: unknown }> = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (init?.method !== "POST")
      return Response.json({ instance: TERMINAL_INSTANCE, sessions: [owned] });
    closes.push({ path: new URL(url).pathname, body: JSON.parse(String(init.body)) });
    const response = await close();
    if (response.ok) owned = { ...owned, state: "exited", signal: 1 };
    return response;
  });
  const mounted = await mountWithQuery(<TerminalReader session={session} />);
  cleanups.push(mounted.cleanup);
  return { ...mounted, closes };
}

it("ends an active terminal from its conversation after confirming the interruption", async () => {
  const session = terminalSession();
  const { container, closes } = await mountReader(session, async () => Response.json({ ok: true }));
  await vi.waitFor(() => expect(findButton("End session")).toBeDefined());
  await act(async () => findButton("End session")?.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "interrupts any command still running",
  );
  expect(closes).toHaveLength(0);
  await act(async () => dialogButton("End session")?.click());
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(closes).toEqual([
    { path: `/api/terminals/${session.id}/close`, body: { instance: TERMINAL_INSTANCE } },
  ]);
  expect(findButton("End session")).toBeUndefined();
  expect(container.textContent).toContain("PTY screen");
});

it("sends a single close while one is pending", async () => {
  const { closes } = await mountReader(terminalSession(), () => new Promise<Response>(() => {}));
  await vi.waitFor(() => expect(findButton("End session")).toBeDefined());
  await act(async () => findButton("End session")?.click());
  const confirm = () =>
    act(async () => {
      dialogButton("End session")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  await confirm();
  expect(dialogButton("End session")?.disabled).toBe(true);
  await confirm();
  expect(dialogButton("Keep working")?.disabled).toBe(true);
  expect(closes).toHaveLength(1);
});

it("keeps a failed close visible without calling the session ended", async () => {
  const { closes } = await mountReader(terminalSession(), async () =>
    Response.json(
      { error: "terminal_refused", message: "Session lost or expired." },
      { status: 409 },
    ),
  );
  await vi.waitFor(() => expect(findButton("End session")).toBeDefined());
  await act(async () => findButton("End session")?.click());
  await act(async () => dialogButton("End session")?.click());
  await vi.waitFor(() =>
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Session lost or expired.",
    ),
  );
  expect(closes).toHaveLength(1);
  await act(async () => dialogButton("Keep working")?.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(findButton("End session")).toBeDefined();
});

it("offers no end action for a session that already ended", async () => {
  const { container } = await mountReader(
    terminalSession({ state: "exited", exit_code: 0 }),
    async () => Response.json({ ok: true }),
  );
  await vi.waitFor(() => expect(container.textContent).toContain("PTY screen"));
  expect(findButton("End session")).toBeUndefined();
});
