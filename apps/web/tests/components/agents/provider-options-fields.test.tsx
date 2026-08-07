// @vitest-environment happy-dom
import type { ProviderOptionSet } from "@otomat/domain";
import { ProviderOptionsFields } from "@web/components/agents/agent-profile/dialog/provider-options-fields";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { mount } from "#support/mount";

let detected: {
  data: ProviderOptionSet | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
};

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimeProviderOptions: () => detected,
}));

const CLAUDE_SET: ProviderOptionSet = {
  runtime: "claude",
  model: null,
  detection: { status: "ok", detail: "Announced by `claude --help`." },
  options: [
    {
      key: "permission_mode",
      description: "How Claude Code decides whether a tool call may proceed.",
      choices: [{ value: "acceptEdits", description: null, dangerous: false }],
      default_value: "acceptEdits",
    },
    {
      key: "effort",
      description: "How much reasoning effort Claude Code spends.",
      choices: [{ value: "max", description: null, dangerous: false }],
      default_value: null,
    },
  ],
};

function resolved(set: ProviderOptionSet | undefined) {
  return { data: set, isPending: false, isError: false, refetch: vi.fn() };
}

it("renders one field per announced option, from the descriptors alone", async () => {
  detected = resolved(CLAUDE_SET);

  const mounted = await mount(
    <ProviderOptionsFields runtime="claude" model={null} options={{}} onOptionsChange={vi.fn()} />,
  );

  expect(document.querySelector('[aria-label="Permission mode"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Effort"]')).not.toBeNull();
  expect(mounted.container.textContent).toContain("claude --help");

  await mounted.cleanup();
});

it("renders nothing tunable, and says so, for a runtime that announces no option", async () => {
  detected = resolved({ ...CLAUDE_SET, options: [] });

  const mounted = await mount(
    <ProviderOptionsFields runtime="fake" model={null} options={{}} onOptionsChange={vi.fn()} />,
  );

  expect(document.querySelector('[aria-label="Permission mode"]')).toBeNull();
  expect(mounted.container.textContent).toContain("No option is tunable here");

  await mounted.cleanup();
});

it("names a stored option this runtime does not offer, and removes it", async () => {
  detected = resolved(CLAUDE_SET);
  const onOptionsChange = vi.fn();

  const mounted = await mount(
    <ProviderOptionsFields
      runtime="claude"
      model={null}
      options={{ sandbox: "workspace-write" }}
      onOptionsChange={onOptionsChange}
    />,
  );

  const alert = document.querySelector('[role="alert"]');
  expect(alert?.textContent).toContain("Sandbox");
  expect(alert?.textContent).toContain("workspace-write");

  const remove = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.includes("Remove it"),
  );
  await act(async () => {
    remove?.click();
  });
  expect(onOptionsChange).toHaveBeenCalledWith({});

  await mounted.cleanup();
});
