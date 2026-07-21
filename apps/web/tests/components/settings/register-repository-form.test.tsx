// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RegisterRepositoryForm } from "@web/components/settings/register-repository-form";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const registerRepository = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: { registerRepository: (request: unknown) => registerRepository(request) },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  registerRepository.mockReset();
  delete window.otomat;
});

function installDesktopBridge(pickDirectory: () => Promise<string | null>): void {
  window.otomat = {
    daemonUrl: "http://127.0.0.1:5000",
    pickDirectory,
    linear: {
      saveKey: async () => ({ ok: true, message: null }),
      forgetKey: async () => ({ ok: true, message: null }),
    },
  };
}

function browseButton(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Browse…",
  );
}

function requireBrowseButton(): HTMLButtonElement {
  const button = browseButton();
  if (button === undefined) throw new Error("Browse button was not rendered");
  return button;
}

async function renderForm() {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  const client = new QueryClient();
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <RegisterRepositoryForm />
      </QueryClientProvider>,
    );
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
  });
}

function pathInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[aria-label='Repository path']");
  if (!input) throw new Error("path input not found");
  return input;
}

function submitButton(): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Register",
  );
  if (!button) throw new Error("Register button not found");
  return button;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("RegisterRepositoryForm", () => {
  it("submits the trimmed path and resets on success", async () => {
    registerRepository.mockResolvedValue({
      project: { id: "p", name: "otomat", root_path: "/repos/otomat" },
      repository: {
        id: "r",
        project_id: "p",
        name: "otomat",
        remote_url: null,
        default_branch: "main",
      },
    });
    await renderForm();

    expect(submitButton().disabled).toBe(true);
    await act(async () => {
      setInputValue(pathInput(), "  /repos/otomat  ");
    });
    await act(async () => {
      submitButton().click();
    });

    expect(registerRepository).toHaveBeenCalledWith({ path: "/repos/otomat" });
    expect(pathInput().value).toBe("");
  });

  it("shows the daemon's refusal message on error and keeps the input", async () => {
    registerRepository.mockRejectedValue(
      new DaemonRequestError(400, "/api/repositories", {
        error: "head_detached",
        message: "The repository's HEAD is detached; check out a branch first.",
      }),
    );
    await renderForm();

    await act(async () => {
      setInputValue(pathInput(), "/repos/broken");
    });
    await act(async () => {
      submitButton().click();
    });

    expect(document.body.textContent).toContain(
      "The repository's HEAD is detached; check out a branch first.",
    );
    expect(pathInput().value).toBe("/repos/broken");

    await act(async () => {
      setInputValue(pathInput(), "/repos/fixed");
    });
    expect(document.body.textContent).not.toContain("The repository's HEAD is detached");
  });

  it("hides the native Browse button when no desktop bridge is present", async () => {
    await renderForm();
    expect(browseButton()).toBeUndefined();
  });

  it("fills the path from the native picker when the desktop bridge is present", async () => {
    installDesktopBridge(async () => "/picked/repo");
    await renderForm();

    await act(async () => {
      requireBrowseButton().click();
    });
    expect(pathInput().value).toBe("/picked/repo");
  });

  it("creates nothing and leaves the path untouched when the picker is canceled", async () => {
    installDesktopBridge(async () => null);
    await renderForm();

    await act(async () => {
      setInputValue(pathInput(), "/typed/path");
    });
    await act(async () => {
      requireBrowseButton().click();
    });

    expect(pathInput().value).toBe("/typed/path");
    expect(registerRepository).not.toHaveBeenCalled();
  });

  it("shows an error when the native picker fails", async () => {
    installDesktopBridge(async () => {
      throw new Error("native dialog failed");
    });
    await renderForm();

    await act(async () => {
      requireBrowseButton().click();
    });

    expect(document.body.textContent).toContain("Could not open the folder picker.");
  });
});
