// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InitCommandsForm } from "@web/components/settings/project/init-commands-form";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setTextareaValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { repository } from "#support/launch-target";
import { mount } from "#support/mount";

const updateRepository = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: {
    updateRepository: (repositoryId: string, request: unknown) =>
      updateRepository(repositoryId, request),
  },
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  updateRepository.mockReset();
});

async function renderForm(initCommands: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const mounted = await mount(
    <QueryClientProvider client={client}>
      <InitCommandsForm repository={repository({ init_commands: initCommands })} />
    </QueryClientProvider>,
  );
  cleanups.push(mounted.cleanup);
}

function commandsBox(): HTMLTextAreaElement {
  const box = document.querySelector("textarea");
  if (box === null) throw new Error("commands textarea not found");
  return box;
}

function saveButton(): HTMLButtonElement {
  const button = findButton("Save init commands");
  if (button === undefined) throw new Error("save button not found");
  return button;
}

it("keeps Save disabled until the commands parse to something else", async () => {
  updateRepository.mockResolvedValue(repository({ init_commands: ["pnpm install"] }));
  await renderForm([]);

  expect(saveButton().disabled).toBe(true);

  await act(async () => {
    setTextareaValue(commandsBox(), "pnpm install\n");
  });
  expect(saveButton().disabled).toBe(false);

  await act(async () => {
    saveButton().click();
  });
  expect(updateRepository).toHaveBeenCalledWith("repo-1", { init_commands: ["pnpm install"] });
});

it("disables Save again when an edit parses back to the saved commands", async () => {
  await renderForm(["pnpm install"]);

  await act(async () => {
    setTextareaValue(commandsBox(), "  pnpm install  \n\n");
  });

  expect(saveButton().disabled).toBe(true);
  expect(updateRepository).not.toHaveBeenCalled();
});

it("saves an empty list when every line is cleared", async () => {
  updateRepository.mockResolvedValue(repository());
  await renderForm(["pnpm install"]);

  await act(async () => {
    setTextareaValue(commandsBox(), "");
  });
  expect(saveButton().disabled).toBe(false);

  await act(async () => {
    saveButton().click();
  });
  expect(updateRepository).toHaveBeenCalledWith("repo-1", { init_commands: [] });
});
