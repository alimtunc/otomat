// @vitest-environment happy-dom
import { TerminalPanel } from "@web/components/terminal/panel";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton, findLabelled } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  delete window.otomat;
  vi.unstubAllGlobals();
});

it.each(["Claude", "Codex"])(
  "launches %s for the selected project after inspection, without fetching issue context",
  async (tool) => {
    window.otomat = fakeDesktopBridge();
    const requests: { path: string; method: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      requests.push({
        path: new URL(url).pathname,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (method === "POST")
        return Response.json(
          { error: "worktree_conflict", message: "CLI unavailable" },
          { status: 409 },
        );
      return Response.json({ instance: "00000000-0000-4000-8000-000000000001", sessions: [] });
    });
    const mounted = await mountWithQuery(
      <TerminalPanel projectId="p2" host={{ id: "local", label: "Local", kind: "local" }} />,
    );
    cleanups.push(mounted.cleanup);
    expect(findLabelled("Copy terminal command")).toBeDefined();
    await act(async () => {
      findButton(tool)?.click();
    });
    expect(findLabelled("Include issue context")).toBeUndefined();
    expect(document.body.textContent).toContain('"arguments": []');
    expect(
      requests.every((request) => request.method === "GET" && request.path === "/api/terminals"),
    ).toBe(true);
    await act(async () => {
      findButton(`Start ${tool}`)?.click();
    });
    await vi.waitFor(() =>
      expect(requests.find((request) => request.method === "POST")?.body).toEqual({
        instance: "00000000-0000-4000-8000-000000000001",
        project_id: "p2",
        tool: tool.toLowerCase(),
      }),
    );
  },
);

it("does not attach a different project's terminal or an issue terminal", async () => {
  window.otomat = fakeDesktopBridge();
  const session = {
    id: "00000000-0000-4000-8000-000000000002",
    project_id: "p1",
    issue_id: null,
    worktree_id: null,
    path: "/tmp/project",
    branch: "main",
    started_at: "2026-09-25T00:00:00Z",
    tool: null,
    state: "running",
    exit_code: null,
    signal: null,
  };
  vi.stubGlobal("fetch", async () =>
    Response.json({
      instance: "00000000-0000-4000-8000-000000000001",
      sessions: [
        session,
        {
          ...session,
          id: "00000000-0000-4000-8000-000000000003",
          project_id: "p2",
          issue_id: "i2",
          worktree_id: "w2",
        },
      ],
    }),
  );
  const mounted = await mountWithQuery(
    <TerminalPanel projectId="p2" host={{ id: "local", label: "Local", kind: "local" }} />,
  );
  cleanups.push(mounted.cleanup);
  expect(findButton("Open shell")).toBeDefined();
  expect(findLabelled("End session")).toBeUndefined();
});
