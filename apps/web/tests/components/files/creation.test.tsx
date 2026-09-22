// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { CheckoutTarget, CreateWorktreeEntryRequest, WorktreeFileEntry } from "@otomat/domain";
import { FileBrowser } from "@web/components/files/browser";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { mountWithQuery } from "#support/mount";

const { createCheckoutEntry } = vi.hoisted(() => ({ createCheckoutEntry: vi.fn() }));
vi.mock("@web/api/client", () => ({ daemon: { createCheckoutEntry } }));

it("creates inline in the selected folder, detects types and duplicates, and cancels with Escape", async () => {
  createCheckoutEntry.mockImplementation(
    async (_target: CheckoutTarget, request: CreateWorktreeEntryRequest) => ({
      ...request,
      size: 0,
      ignored: false,
    }),
  );
  const entries: WorktreeFileEntry[] = [
    { path: "src/lib/util.ts", kind: "file", size: 0, ignored: false },
    { path: "src/app.ts", kind: "file", size: 0, ignored: false },
  ];
  const onSelect = vi.fn();
  const props = {
    target: { kind: "repository", id: "repo" } as const,
    editable: true,
    activePath: null,
    onSelect,
    onCreated: vi.fn(),
  };
  const mounted = await mountWithQuery(<FileBrowser {...props} entries={entries} />);
  const folder = mounted.container.querySelector<HTMLButtonElement>('button[title="src"]');
  const add = mounted.container.querySelector<HTMLButtonElement>('button[aria-label="New file"]');
  if (folder === null || add === null) throw new Error("Explorer actions missing");
  await act(async () => folder.click());
  await act(async () => add.click());
  const input = mounted.container.querySelector<HTMLInputElement>(
    'input[aria-label="New file name"]',
  );
  if (input === null) throw new Error("Inline name missing");
  expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
  expect(input.closest("form")?.getAttribute("aria-label")).toBe("Create file in src");
  expect(input.closest("li")?.previousElementSibling?.textContent).toBe("lib");
  await act(async () => setInputValue(input, ".git"));
  expect(mounted.container.querySelector('[role="alert"]')?.textContent).toContain(
    "reserved by Git",
  );
  await act(async () => setInputValue(input, ".gitignore"));
  expect(mounted.container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => setInputValue(input, "lib"));
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(mounted.container.querySelector('[role="alert"]')?.textContent).toContain(
    "already exists",
  );
  await act(async () => setInputValue(input, "app.ts"));
  await act(async () =>
    input.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(createCheckoutEntry).not.toHaveBeenCalled();
  await act(async () => setInputValue(input, "new.json"));
  expect(mounted.container.querySelector('[role="alert"]')).toBeNull();
  expect(input.closest("li")?.querySelector(".text-warning")).not.toBeNull();
  await act(async () => setInputValue(input, "new.ts"));
  expect(input.closest("li")?.querySelector(".text-info")).not.toBeNull();
  await mounted.rerender(
    <FileBrowser
      {...props}
      entries={[...entries, { path: "src/a.ts", kind: "file", size: 0, ignored: false }]}
    />,
  );
  expect(mounted.container.querySelector('input[aria-label="New file name"]')).toBe(input);
  expect(input.value).toBe("new.ts");
  await act(async () =>
    input.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith("src/new.ts"));
  expect(createCheckoutEntry).toHaveBeenCalledWith(
    { kind: "repository", id: "repo" },
    { path: "src/new.ts", kind: "file" },
  );
  await act(async () => add.click());
  const cancel = mounted.container.querySelector<HTMLInputElement>(
    'input[aria-label="New file name"]',
  );
  if (cancel === null) throw new Error("Inline name missing");
  await act(async () =>
    cancel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  expect(mounted.container.querySelector('input[aria-label="New file name"]')).toBeNull();
  expect(document.activeElement).toBe(add);
  await mounted.cleanup();
});

it("opens a file the daemon alone knows exists instead of showing the refusal", async () => {
  const exists = new DaemonRequestError(409, "POST", "/api/repositories/repo/tree", {
    error: "path_exists",
    message: "A file or folder already exists at this path.",
  });
  createCheckoutEntry.mockRejectedValue(exists);
  const onSelect = vi.fn();
  const mounted = await mountWithQuery(
    <FileBrowser
      target={{ kind: "repository", id: "repo" }}
      editable
      entries={[{ path: "README.md", kind: "file", size: 0, ignored: false }]}
      activePath={null}
      onSelect={onSelect}
      onCreated={vi.fn()}
    />,
  );
  const add = mounted.container.querySelector<HTMLButtonElement>('button[aria-label="New file"]');
  if (add === null) throw new Error("Explorer actions missing");
  await act(async () => add.click());
  const input = mounted.container.querySelector<HTMLInputElement>(
    'input[aria-label="New file name"]',
  );
  if (input === null) throw new Error("Inline name missing");
  await act(async () => setInputValue(input, ".env"));
  await act(async () =>
    input.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(".env"));
  expect(mounted.container.querySelector('input[aria-label="New file name"]')).toBeNull();
  expect(mounted.container.querySelector('[role="alert"]')).toBeNull();

  const addFolder = mounted.container.querySelector<HTMLButtonElement>(
    'button[aria-label="New folder"]',
  );
  if (addFolder === null) throw new Error("Explorer actions missing");
  await act(async () => addFolder.click());
  const folder = mounted.container.querySelector<HTMLInputElement>(
    'input[aria-label="New folder name"]',
  );
  if (folder === null) throw new Error("Inline name missing");
  await act(async () => setInputValue(folder, "node_modules"));
  await act(async () =>
    folder.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  await vi.waitFor(() =>
    expect(mounted.container.querySelector('[role="alert"]')?.textContent).toContain(
      "already exists",
    ),
  );
  expect(onSelect).toHaveBeenCalledTimes(1);
  await mounted.cleanup();
});
