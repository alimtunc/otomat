import { EventEmitter } from "node:events";

import { shell, type Session, type WebContents } from "electron";
import { expect, it, vi } from "vitest";

import { denyRendererPermissions, hardenWebContents } from "#main/security";
import { APP_ORIGIN } from "#shared/constants";

vi.mock("electron", () => ({ shell: { openExternal: vi.fn() } }));

type Permission = Parameters<NonNullable<Parameters<Session["setPermissionCheckHandler"]>[0]>>[1];

// SAFETY: the guard decides from the permission and the requesting URL, never from the contents.
const contents = {} as WebContents;

interface Guarded {
  request: (permission: Permission, url: string) => boolean;
  check: (permission: Permission, origin: string) => boolean;
  log: string[];
}

function guard(): Guarded {
  const session = {
    setPermissionRequestHandler: vi.fn<Session["setPermissionRequestHandler"]>(),
    setPermissionCheckHandler: vi.fn<Session["setPermissionCheckHandler"]>(),
  };
  const log: string[] = [];
  denyRendererPermissions(session, [APP_ORIGIN], (message) => log.push(message));
  const request = session.setPermissionRequestHandler.mock.calls[0]?.[0];
  const check = session.setPermissionCheckHandler.mock.calls[0]?.[0];
  if (!request || !check) throw new Error("Both permission handlers must be installed.");
  return {
    request: (permission, url) => {
      let granted: boolean | null = null;
      request(contents, permission, (value) => (granted = value), {
        requestingUrl: url,
        isMainFrame: true,
      });
      return granted ?? false;
    },
    check: (permission, origin) => check(null, permission, origin, { isMainFrame: true }),
    log,
  };
}

it("refuses every capability the renderer asks for and logs the refusal", () => {
  const guarded = guard();

  expect(guarded.request("notifications", `${APP_ORIGIN}/`)).toBe(false);
  expect(guarded.request("media", `${APP_ORIGIN}/`)).toBe(false);
  expect(guarded.check("geolocation", APP_ORIGIN)).toBe(false);
  expect(guarded.log).toEqual([
    `Denied renderer permission "notifications" for ${APP_ORIGIN}/`,
    `Denied renderer permission "media" for ${APP_ORIGIN}/`,
    `Denied renderer permission "geolocation" for ${APP_ORIGIN}`,
  ]);
});

it("keeps the cockpit's own copy buttons working, and only from the app origin", () => {
  const guarded = guard();

  expect(guarded.request("clipboard-sanitized-write", `${APP_ORIGIN}/runs/1`)).toBe(true);
  expect(guarded.check("clipboard-sanitized-write", APP_ORIGIN)).toBe(true);
  expect(guarded.check("clipboard-sanitized-write", "https://evil.example")).toBe(false);
  expect(guarded.check("clipboard-sanitized-write", `${APP_ORIGIN}.evil.example`)).toBe(false);
  expect(guarded.request("clipboard-read", `${APP_ORIGIN}/`)).toBe(false);
  expect(guarded.log).toEqual([
    'Denied renderer permission "clipboard-sanitized-write" for https://evil.example',
    `Denied renderer permission "clipboard-sanitized-write" for ${APP_ORIGIN}.evil.example`,
    `Denied renderer permission "clipboard-read" for ${APP_ORIGIN}/`,
  ]);
});

function harden(navigable: unknown): void {
  // SAFETY: hardening installs one window-open handler and listens for navigations.
  hardenWebContents(navigable as WebContents, [APP_ORIGIN]);
}

it("lets a renderer navigate within the app origin and sends anything else to the browser", () => {
  const emitter = new EventEmitter();
  harden(Object.assign(emitter, { setWindowOpenHandler: vi.fn() }));
  const prevented = (url: string): boolean => {
    let stopped = false;
    emitter.emit("will-navigate", { preventDefault: () => (stopped = true) }, url);
    return stopped;
  };

  expect(prevented(`${APP_ORIGIN}/runs/1`)).toBe(false);
  expect(prevented("https://example.com/docs")).toBe(true);
  expect(prevented(`${APP_ORIGIN}.evil.example/`)).toBe(true);
  expect(vi.mocked(shell.openExternal).mock.calls).toEqual([["https://example.com/docs"]]);
});
