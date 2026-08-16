// @vitest-environment happy-dom
import {
  ConfigMenu,
  ConfigMenuChoice,
  ConfigMenuContent,
  ConfigMenuSubmenu,
  ConfigMenuTrigger,
  DropdownMenuRadioGroup,
} from "@otomat/ui";
import { act } from "react";
import { afterEach, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

const LONG_VALUE =
  "gpt-5.6-sol-preview-2026-08-01-extended-reasoning — from “Careful reviewer, escalating”";

afterEach(async () => {
  await unmountAll();
  document.body.replaceChildren();
});

async function open(): Promise<HTMLButtonElement> {
  await render(
    <ConfigMenu>
      <ConfigMenuTrigger label="Single run" summary={LONG_VALUE} detail={LONG_VALUE} />
      <ConfigMenuContent aria-label="Single run">
        <ConfigMenuSubmenu label="Model" value={LONG_VALUE} hint="Listed by the installed binary.">
          <DropdownMenuRadioGroup value="a">
            <ConfigMenuChoice value="a" label="Extra high" hint="xhigh" />
          </DropdownMenuRadioGroup>
        </ConfigMenuSubmenu>
      </ConfigMenuContent>
    </ConfigMenu>,
  );
  const trigger = document.querySelector<HTMLButtonElement>("button[aria-label^='Single run']");
  if (trigger === null) throw new Error("the config menu trigger is missing");
  await act(async () => trigger.click());
  return trigger;
}

it("keeps the trigger on one ellipsised line while naming the whole configuration", async () => {
  const trigger = await open();

  expect(trigger.querySelector(".truncate")?.textContent).toBe(LONG_VALUE);
  expect(trigger.getAttribute("aria-label")).toBe(`Single run: ${LONG_VALUE}`);
});

it("bounds every popup and scrolls inside it rather than past the viewport", async () => {
  await open();

  const popup = document.querySelector("[aria-label='Single run']:not(button)");
  expect(popup?.className).toContain("overflow-y-auto");
  expect(popup?.className).toContain("max-h-[min(22rem,var(--available-height))]");
  expect(popup?.className).toContain("max-w-[min(20rem,calc(100vw-2rem))]");
});

it("clamps a long value to two lines and keeps its full text reachable", async () => {
  await open();

  const row = document.querySelector<HTMLElement>("[aria-label^='Model:']");
  const value = row?.querySelector(".line-clamp-2");
  expect(value?.textContent).toBe(LONG_VALUE);
  expect(value?.getAttribute("title")).toContain("Listed by the installed binary.");
  expect(row?.getAttribute("aria-label")).toContain("Listed by the installed binary.");
});

it("shows a humanized label without hiding the identifier the CLI receives", async () => {
  await open();
  const submenu = document.querySelector<HTMLElement>("[aria-label^='Model:']");
  if (submenu === null) throw new Error("the model submenu trigger is missing");
  await act(async () => submenu.click());

  const choice = document.querySelector<HTMLElement>("[role='menuitemradio']");
  expect(choice?.textContent).toContain("Extra high");
  expect(choice?.querySelector("code")?.textContent).toBe("xhigh");
});
