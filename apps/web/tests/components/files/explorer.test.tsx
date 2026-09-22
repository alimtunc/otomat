// @vitest-environment happy-dom
import type { WorktreeFileContent, WorktreeFileEntry } from "@otomat/domain";
import { FilesExplorer } from "@web/components/files/explorer";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { mountWithQuery } from "#support/mount";

type Search = Record<string, unknown>;

const { createCheckoutEntry, getCheckoutFile, getSourceControl, search } = vi.hoisted(() => {
  const current: Search = {};
  return {
    createCheckoutEntry: vi.fn(),
    getCheckoutFile: vi.fn(),
    getSourceControl: vi.fn(),
    search: { current },
  };
});
vi.mock("@web/api/client", () => ({
  daemon: { createCheckoutEntry, getCheckoutFile, getSourceControl },
}));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search.current,
  useNavigate:
    () =>
    ({ search: next }: { search: (previous: Search) => Search }) => {
      search.current = next(search.current);
    },
  useBlocker: () => undefined,
}));
vi.mock("@web/components/files/code-editor", () => ({
  CodeEditor: ({ doc }: { doc: string }) => <pre data-testid="editor">{doc}</pre>,
}));

const TARGET = { kind: "repository", id: "repo" } as const;
const ENTRIES: WorktreeFileEntry[] = [{ path: "README.md", kind: "file", size: 1, ignored: false }];
const ENV: WorktreeFileContent = {
  kind: "text",
  path: ".env",
  revision: "rev-1",
  bytes: 4,
  text: "A=1\n",
  ignored: true,
};

it("keeps a created ignored file listed and marked after the listing drops it", async () => {
  createCheckoutEntry.mockResolvedValue({ path: ".env", kind: "file", size: 0, ignored: true });
  getCheckoutFile.mockResolvedValue(ENV);
  getSourceControl.mockResolvedValue({
    branch: "main",
    revision: "r",
    conflicts: [],
    staged: [],
    unstaged: [],
  });
  const mounted = await mountWithQuery(
    <FilesExplorer target={TARGET} entries={ENTRIES} editable />,
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
  await vi.waitFor(() => expect(search.current.file).toBe(".env"));
  await mounted.rerender(<FilesExplorer target={TARGET} entries={ENTRIES} editable />);
  await vi.waitFor(() => {
    expect(mounted.container.querySelector('[data-testid="editor"]')?.textContent).toBe("A=1\n");
  });
  expect(mounted.container.textContent).toContain("Ignored by Git: this file stays local");

  await mounted.rerender(<FilesExplorer target={TARGET} entries={[...ENTRIES]} editable />);
  const row = mounted.container.querySelector('nav button[title=".env"]');
  expect(row?.querySelector('[title="Ignored by Git"]')?.textContent).toBe("Ignored");
  expect(row?.getAttribute("aria-current")).toBe("true");
  await mounted.cleanup();
});
