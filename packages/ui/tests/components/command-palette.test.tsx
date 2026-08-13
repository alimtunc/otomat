// @vitest-environment happy-dom
import { CommandPalette, type CommandPaletteGroup } from "@otomat/ui";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { render, unmountAll } from "#test-support/render";

afterEach(async () => {
  await unmountAll();
  document.body.replaceChildren();
});

function issuesGroup(onSelect: () => void): CommandPaletteGroup {
  return {
    id: "issues",
    heading: "Issues · otomat",
    notice: <p>Showing 8 of 10 matches.</p>,
    commands: [{ id: "issue-1", label: "Retry queue drain", refId: "OTO-42", onSelect }],
  };
}

it("renders every command it is given, leaving the matching to its owner", async () => {
  await render(
    <CommandPalette
      open
      onOpenChange={() => undefined}
      search="webhook receiver"
      onSearchChange={() => undefined}
      groups={[issuesGroup(() => undefined)]}
    />,
  );

  expect(document.body.textContent).toContain("OTO-42");
  expect(document.body.textContent).toContain("Retry queue drain");
  expect(document.body.textContent).toContain("Showing 8 of 10 matches.");
});

it("runs the clicked command and closes behind it", async () => {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  await render(
    <CommandPalette
      open
      onOpenChange={onOpenChange}
      search="oto-42"
      onSearchChange={() => undefined}
      groups={[issuesGroup(onSelect)]}
    />,
  );

  await act(async () => {
    document.querySelector<HTMLElement>("[cmdk-item]")?.click();
  });

  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("hands every keystroke to the search owner", async () => {
  const onSearchChange = vi.fn();
  await render(
    <CommandPalette
      open
      onOpenChange={() => undefined}
      search=""
      onSearchChange={onSearchChange}
      groups={[issuesGroup(() => undefined)]}
    />,
  );

  const input = document.querySelector<HTMLInputElement>("[cmdk-input]");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "OTO-42");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(onSearchChange).toHaveBeenCalledWith("OTO-42");
});
