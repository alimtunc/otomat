// @vitest-environment happy-dom
import type { LinearVaultOperationResult } from "@otomat/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinearConnectForm } from "@web/components/settings/integrations/linear-connect-form";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { mount } from "#support/mount";

const connectLinear = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: { connectLinear: (request: unknown) => connectLinear(request) },
}));

const KEY = "lin_api_secret";
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  connectLinear.mockReset();
  localStorage.clear();
  delete window.otomat;
});

function installDesktopBridge(
  saveKey: (apiKey: string) => Promise<LinearVaultOperationResult>,
): void {
  window.otomat = {
    daemonUrl: "http://127.0.0.1:5000",
    pickDirectory: async () => null,
    linear: {
      saveKey,
      forgetKey: async () => ({ ok: true, message: null }),
    },
  };
}

async function renderForm(connectionError: string | null = null) {
  const client = new QueryClient();
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const mounted = await mount(
    <QueryClientProvider client={client}>
      <LinearConnectForm connectionError={connectionError} />
    </QueryClientProvider>,
  );
  cleanups.push(mounted.cleanup);
  return { invalidateQueries };
}

function keyInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    "input[aria-label='Linear Personal API key']",
  );
  if (!input) throw new Error("key input not found");
  return input;
}

function connectButton(): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Connect",
  );
  if (!button) throw new Error("Connect button not found");
  return button;
}

async function submitKey(value: string) {
  const rendered = await renderForm();
  await act(async () => setInputValue(keyInput(), value));
  await act(async () => {
    connectButton().click();
  });
  return rendered;
}

it("masks the key and never persists it in the renderer", async () => {
  connectLinear.mockResolvedValue({
    status: "connected",
    workspace_id: "workspace-1",
    workspace_name: "Otomat",
    user_name: "Alim",
    error_code: null,
    error_message: null,
  });

  await submitKey(KEY);

  expect(keyInput().type).toBe("password");
  expect(keyInput().value).toBe("");
  expect(JSON.stringify(localStorage)).not.toContain(KEY);
  expect(document.body.innerHTML).not.toContain(KEY);
});

it("sends the key straight to the daemon in a plain browser", async () => {
  connectLinear.mockResolvedValue({
    status: "connected",
    workspace_id: "workspace-1",
    workspace_name: "Otomat",
    user_name: "Alim",
    error_code: null,
    error_message: null,
  });

  await submitKey(KEY);

  expect(connectLinear).toHaveBeenCalledWith({ api_key: KEY });
  expect(document.body.textContent).toContain("forgotten when the daemon restarts");
});

it("routes the key through the desktop vault when running in Electron", async () => {
  const saveKey = vi.fn().mockResolvedValue({ ok: true, message: null });
  installDesktopBridge(saveKey);

  await submitKey(KEY);

  expect(saveKey).toHaveBeenCalledWith(KEY);
  expect(connectLinear).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Stored encrypted on this device");
});

it("surfaces a rejected key without clearing the form silently", async () => {
  connectLinear.mockResolvedValue({
    status: "failed",
    workspace_id: null,
    workspace_name: null,
    user_name: null,
    error_code: "linear_unauthorized",
    error_message: "Linear rejected the API key. Create a new key and connect again.",
  });

  const { invalidateQueries } = await submitKey("bad-key");

  const alert = document.querySelector("[role='alert']");
  expect(alert?.textContent).toContain("Linear rejected the API key");
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["linear"] });
});

it("shows a restored connection error once and hides it when the key changes", async () => {
  await renderForm("Linear rejected the saved API key.");

  expect(document.querySelectorAll("[role='alert']")).toHaveLength(1);
  expect(document.body.textContent).toContain("Linear rejected the saved API key.");

  await act(async () => setInputValue(keyInput(), "replacement-key"));

  expect(document.querySelector("[role='alert']")).toBeNull();
});

it("silences a desktop connection superseded by a newer attempt", async () => {
  installDesktopBridge(async () => ({
    ok: false,
    message: "A newer Linear connection state replaced this request.",
    error_code: "linear_request_superseded",
  }));

  await submitKey("first-key");

  expect(document.querySelector("[role='alert']")).toBeNull();
});
