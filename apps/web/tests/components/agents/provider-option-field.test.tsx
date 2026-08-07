// @vitest-environment happy-dom
import type { ProviderOptionDescriptor } from "@otomat/domain";
import { ProviderOptionField } from "@web/components/agents/agent-profile/dialog/provider-option-field";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { mount } from "#support/mount";

const permissionMode: ProviderOptionDescriptor = {
  key: "permission_mode",
  description: "How Claude Code decides whether a tool call may proceed.",
  choices: [
    { value: "acceptEdits", description: "Auto-approves edits.", dangerous: false },
    { value: "auto", description: null, dangerous: false },
    { value: "bypassPermissions", description: "Skips every check.", dangerous: true },
  ],
  default_value: "acceptEdits",
};

function option(label: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) =>
    element.textContent?.includes(label),
  );
}

async function openPicker(): Promise<void> {
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Permission mode"]');
  await act(async () => {
    trigger?.click();
  });
}

it("names the value the runtime applies when nothing is chosen", async () => {
  const mounted = await mount(
    <ProviderOptionField descriptor={permissionMode} value={null} onValueChange={vi.fn()} />,
  );

  const trigger = document.querySelector('[aria-label="Permission mode"]');
  expect(trigger?.textContent).toContain("Runtime default");
  expect(trigger?.textContent).toContain("Accept edits");

  await mounted.cleanup();
});

it("stores an ordinary value as soon as it is picked", async () => {
  const onValueChange = vi.fn();
  const mounted = await mount(
    <ProviderOptionField descriptor={permissionMode} value={null} onValueChange={onValueChange} />,
  );

  await openPicker();
  await act(async () => {
    option("Auto")?.click();
  });

  expect(onValueChange).toHaveBeenCalledWith("auto");

  await mounted.cleanup();
});

it("never stores a dangerous value on the pick alone; it asks first", async () => {
  const onValueChange = vi.fn();
  const mounted = await mount(
    <ProviderOptionField descriptor={permissionMode} value={null} onValueChange={onValueChange} />,
  );

  await openPicker();
  await act(async () => {
    option("Bypass permissions")?.click();
  });

  expect(onValueChange).not.toHaveBeenCalled();
  const alert = document.querySelector('[role="alert"]');
  expect(alert?.textContent).toContain("removes a safety boundary");

  const confirm = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.includes("Store it anyway"),
  );
  await act(async () => {
    confirm?.click();
  });
  expect(onValueChange).toHaveBeenCalledWith("bypassPermissions");

  await mounted.cleanup();
});

it("keeps a value the CLI dropped visible, and says it is no longer offered", async () => {
  const mounted = await mount(
    <ProviderOptionField descriptor={permissionMode} value="default" onValueChange={vi.fn()} />,
  );

  const trigger = document.querySelector('[aria-label="Permission mode"]');
  expect(trigger?.textContent).toContain("Default");
  expect(trigger?.textContent).toContain("no longer offered");

  await mounted.cleanup();
});
