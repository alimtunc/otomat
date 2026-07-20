// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinearConnectForm } from "@web/components/settings/integrations/linear-connect-form";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const connectLinear = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: { connectLinear: (request: unknown) => connectLinear(request) },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const KEY = "lin_api_secret";
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  connectLinear.mockReset();
  localStorage.clear();
  delete window.otomat;
});

function installDesktopBridge(saveKey: (apiKey: string) => Promise<unknown>): void {
  window.otomat = {
    daemonUrl: "http://127.0.0.1:5000",
    pickDirectory: async () => null,
    linear: {
      vaultStatus: async () => ({ encryption_available: true, has_stored_key: false }),
      saveKey: (apiKey: string) => saveKey(apiKey) as never,
      forgetKey: async () => ({ ok: true, message: null }),
    },
  };
}

async function renderForm() {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  const client = new QueryClient();
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <LinearConnectForm />
      </QueryClientProvider>,
    );
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
  });
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

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submitKey(value: string) {
  await renderForm();
  await act(async () => setInputValue(keyInput(), value));
  await act(async () => {
    connectButton().click();
  });
}

it("masks the key and never persists it in the renderer", async () => {
  connectLinear.mockResolvedValue({
    status: "connected",
    workspace_name: "Otomat",
    workspace_url_key: "otomat",
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
    workspace_name: "Otomat",
    workspace_url_key: "otomat",
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
    workspace_name: null,
    workspace_url_key: null,
    user_name: null,
    error_code: "linear_unauthorized",
    error_message: "Linear rejected the API key. Create a new key and connect again.",
  });

  await submitKey("bad-key");

  const alert = document.querySelector("[role='alert']");
  expect(alert?.textContent).toContain("Linear rejected the API key");
});
