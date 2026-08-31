// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { ConnectLinearRequest, LinearVaultOperationResult } from "@otomat/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinearConnectForm } from "@web/components/settings/integrations/linear/connect-form";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { setInputValue } from "#support/dom-events";
import { mount } from "#support/mount";

const connectLinear = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: { connectLinear: (request: unknown) => connectLinear(request) },
}));

const KEY = "lin_api_secret";
const LABEL = "Otomat";
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  connectLinear.mockReset();
  localStorage.clear();
  delete window.otomat;
});

function installDesktopBridge(
  saveKey: (request: ConnectLinearRequest) => Promise<LinearVaultOperationResult>,
): void {
  const bridge = fakeDesktopBridge();
  bridge.linear.saveKey = saveKey;
  window.otomat = bridge;
}

async function renderForm() {
  const client = new QueryClient();
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const mounted = await mount(
    <QueryClientProvider client={client}>
      <LinearConnectForm />
    </QueryClientProvider>,
  );
  cleanups.push(mounted.cleanup);
  return { invalidateQueries };
}

function input(label: string): HTMLInputElement {
  const found = document.querySelector<HTMLInputElement>(`input[aria-label='${label}']`);
  if (!found) throw new Error(`${label} input not found`);
  return found;
}

function keyInput(): HTMLInputElement {
  return input("Linear Personal API key");
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
  await act(async () => setInputValue(input("Linear connection name"), LABEL));
  await act(async () => setInputValue(keyInput(), value));
  await act(async () => {
    connectButton().click();
  });
  return rendered;
}

it("masks the key and never persists it in the renderer", async () => {
  connectLinear.mockResolvedValue({ status: "connected" });

  await submitKey(KEY);

  expect(keyInput().type).toBe("password");
  expect(keyInput().value).toBe("");
  expect(JSON.stringify(localStorage)).not.toContain(KEY);
  expect(document.body.innerHTML).not.toContain(KEY);
});

it("sends the labelled key straight to the daemon in a plain browser", async () => {
  connectLinear.mockResolvedValue({ status: "connected" });

  await submitKey(KEY);

  expect(connectLinear).toHaveBeenCalledWith({
    id: expect.any(String),
    label: LABEL,
    api_key: KEY,
  });
  expect(document.body.textContent).toContain("forgotten when the daemon restarts");
});

it("routes the key through the desktop vault when running in Electron", async () => {
  const saveKey = vi.fn().mockResolvedValue({ ok: true, message: null });
  installDesktopBridge(saveKey);

  await submitKey(KEY);

  expect(saveKey).toHaveBeenCalledWith({ id: expect.any(String), label: LABEL, api_key: KEY });
  expect(connectLinear).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Stored encrypted on this device");
});

it("gives each new connection its own identifier", async () => {
  connectLinear.mockResolvedValue({ status: "connected" });

  await submitKey(KEY);
  await submitKey("lin_api_other");

  const [first, second] = connectLinear.mock.calls.map(([request]) => request.id);
  expect(first).not.toBe(second);
});

it("surfaces a rejected key without clearing the form silently", async () => {
  connectLinear.mockRejectedValue(
    new DaemonRequestError(409, "POST", "/api/linear/connections", {
      error: "linear_unauthorized",
      message: "Linear rejected the API key. Create a new key and connect again.",
    }),
  );

  const { invalidateQueries } = await submitKey("bad-key");

  const alert = document.querySelector("[role='alert']");
  expect(alert?.textContent).toContain("Linear rejected the API key");
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["linear"] });
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
