// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddProjectDialog } from "@web/components/shell/project-selection/add-project-dialog";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { setInputValue } from "#support/dom-events";
import { mount } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

const TWO_HOSTS = [
  { id: "local" as const, label: "Local", active: true },
  { id: "remote" as const, label: "otomat-vps", active: false },
];

async function renderDialog(onSelect: (switcherId: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const mounted = await mount(
    <QueryClientProvider client={client}>
      <AddProjectDialog open onOpenChange={() => {}} hosts={TWO_HOSTS} onSelect={onSelect} />
    </QueryClientProvider>,
  );
  cleanups.push(mounted.cleanup);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function pathInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[aria-label='Repository path']");
  if (input === null) throw new Error("path input not found");
  return input;
}

function submitButton(): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Add project",
  );
  if (button === undefined) throw new Error("submit button not found");
  return button;
}

it("registers on the chosen host and hands the new project's switcher key to selection", async () => {
  const registerProject = vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      project: { id: "p-vps", name: "vps-app", root_path: "/srv/app", has_repository: true },
    }),
  );
  const bridge = fakeDesktopBridge();
  bridge.executionHost.registerProject = registerProject;
  window.otomat = bridge;
  const onSelect = vi.fn();
  await renderDialog(onSelect);

  const remoteTab = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "otomat-vps",
  );
  await act(async () => {
    remoteTab?.click();
  });
  await act(async () => {
    setInputValue(pathInput(), "/srv/app");
  });
  await act(async () => {
    submitButton().click();
  });

  expect(registerProject).toHaveBeenCalledWith("remote", "/srv/app");
  expect(onSelect).toHaveBeenCalledWith("remote:p-vps");
});

it("shows the daemon's refusal and keeps the dialog open", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.registerProject = () =>
    Promise.resolve({ ok: false as const, message: "Not a git repository." });
  window.otomat = bridge;
  const onSelect = vi.fn();
  await renderDialog(onSelect);

  await act(async () => {
    setInputValue(pathInput(), "/tmp/nope");
  });
  await act(async () => {
    submitButton().click();
  });

  expect(document.body.textContent).toContain("Not a git repository.");
  expect(onSelect).not.toHaveBeenCalled();
});

it("refuses an empty path before calling any host", async () => {
  const registerProject = vi.fn();
  const bridge = fakeDesktopBridge();
  bridge.executionHost.registerProject = registerProject;
  window.otomat = bridge;
  await renderDialog(vi.fn());

  await act(async () => {
    submitButton().click();
  });

  expect(registerProject).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Enter the repository's absolute path");
});
