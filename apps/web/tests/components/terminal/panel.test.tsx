// @vitest-environment happy-dom
import { TerminalPanel } from "@web/components/terminal/panel";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton, findLabelled } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

vi.mock("@web/components/terminal/screen", () => ({ TerminalScreen: () => <div>PTY screen</div> }));
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  delete window.otomat;
  vi.unstubAllGlobals();
});

it("reads only on mount, shows literal argv, and requires confirmation before launch", async () => {
  window.otomat = fakeDesktopBridge();
  const requests: { path: string; method: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    const method = init?.method ?? "GET";
    requests.push({
      path,
      method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    if (path.endsWith("/context/i1"))
      return Response.json({
        executable: "codex",
        argv: ["Issue: i1\n$(touch /tmp/unwanted)"],
        context_hash: "preview-hash",
      });
    if (method === "POST")
      return Response.json({ error: "worktree_conflict", message: "CLI missing" }, { status: 409 });
    return Response.json({ instance: "00000000-0000-4000-8000-000000000001", sessions: [] });
  });
  const mounted = await mountWithQuery(
    <TerminalPanel
      issueId="i1"
      runId={null}
      host={{ id: "local", label: "Local", kind: "local" }}
    />,
  );
  cleanups.push(mounted.cleanup);
  expect(requests.map((request) => request.method)).toEqual(["GET"]);
  await act(async () => {
    findButton("Codex")?.click();
  });
  await vi.waitFor(() => expect(document.body.textContent).toContain("$(touch /tmp/unwanted)"));
  expect(requests.some((request) => request.method === "POST")).toBe(false);
  await act(async () => {
    findButton("Start Codex")?.click();
  });
  await vi.waitFor(() => expect(document.body.textContent).toContain("CLI missing"));
  expect(requests.find((request) => request.method === "POST")?.body).toEqual({
    instance: "00000000-0000-4000-8000-000000000001",
    issue_id: "i1",
    run_id: null,
    tool: "codex",
    context_hash: "preview-hash",
  });
  expect(findLabelled("Open in external terminal")).toBeDefined();
});

it("offers the external fallback when the host has no PTY service", async () => {
  window.otomat = fakeDesktopBridge();
  vi.stubGlobal("fetch", async () => Response.json({ instance: null, sessions: [] }));
  const mounted = await mountWithQuery(
    <TerminalPanel issueId="i1" runId={null} host={{ id: "remote", label: "VPS", kind: "ssh" }} />,
  );
  cleanups.push(mounted.cleanup);
  expect(findButton("Open shell")).toBeUndefined();
  expect(findLabelled("Copy SSH command")?.hasAttribute("disabled")).toBe(false);
  expect(mounted.container.textContent).toContain("Integrated terminal unavailable");
});

it("requires confirmation to stop a live shell and preserves it when dismissed", async () => {
  window.otomat = fakeDesktopBridge();
  const closeRequests: string[] = [];
  const session = {
    id: "00000000-0000-4000-8000-000000000002",
    issue_id: "i1",
    project_id: "local-default",
    worktree_id: "w1",
    path: "/tmp/worktree",
    branch: "feat/demo",
    started_at: "2026-09-24T00:00:00Z",
    tool: null,
    state: "running",
    exit_code: null,
    signal: null,
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      closeRequests.push(url);
      return Response.json(
        { error: "worktree_conflict", message: "Could not stop this session" },
        { status: 409 },
      );
    }
    return Response.json({ instance: "00000000-0000-4000-8000-000000000001", sessions: [session] });
  });
  const mounted = await mountWithQuery(
    <TerminalPanel
      issueId="i1"
      runId={null}
      host={{ id: "local", label: "Local", kind: "local" }}
    />,
  );
  cleanups.push(mounted.cleanup);
  expect(findButton("Open shell")).toBeUndefined();
  await act(async () => {
    findLabelled("End session")?.click();
  });
  expect(document.body.textContent).toContain("End this session?");
  expect(closeRequests).toHaveLength(0);
  await act(async () => {
    findButton("Keep working")?.click();
  });
  expect(closeRequests).toHaveLength(0);
  await act(async () => {
    findLabelled("End session")?.click();
  });
  await act(async () => {
    findButton("End session")?.click();
  });
  await vi.waitFor(() => expect(closeRequests).toHaveLength(1));
  expect(closeRequests[0]).toContain(`/terminals/${session.id}/close`);
  await vi.waitFor(() =>
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Could not stop this session",
    ),
  );
});

it.each(["Claude", "Codex"])(
  "can launch %s without issue context even when context is unavailable",
  async (label) => {
    window.otomat = fakeDesktopBridge();
    const launches: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        launches.push(JSON.parse(String(init.body)));
        return Response.json(
          { error: "worktree_conflict", message: "CLI unavailable" },
          { status: 409 },
        );
      }
      if (url.includes("/context/"))
        return Response.json(
          { error: "worktree_conflict", message: "Issue context too large" },
          { status: 409 },
        );
      return Response.json({ instance: "00000000-0000-4000-8000-000000000001", sessions: [] });
    });
    const mounted = await mountWithQuery(
      <TerminalPanel
        issueId="i1"
        runId={null}
        host={{ id: "local", label: "Local", kind: "local" }}
      />,
    );
    cleanups.push(mounted.cleanup);
    await act(async () => {
      findButton(label)?.click();
    });
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Could not load issue context"),
    );
    expect(findButton(`Start ${label}`)?.disabled).toBe(true);
    await act(async () => {
      findLabelled("Include issue context")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(findButton(`Start ${label}`)?.disabled).toBe(false));
    expect(document.body.textContent).toContain('"arguments": []');
    expect(launches).toHaveLength(0);
    await act(async () => {
      findButton(`Start ${label}`)?.click();
    });
    await vi.waitFor(() =>
      expect(launches).toEqual([
        {
          instance: "00000000-0000-4000-8000-000000000001",
          issue_id: "i1",
          run_id: null,
          tool: label.toLowerCase(),
          context_hash: null,
        },
      ]),
    );
  },
);
