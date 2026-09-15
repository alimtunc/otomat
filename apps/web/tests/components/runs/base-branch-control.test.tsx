// @vitest-environment happy-dom
import { BaseBranchControl } from "@web/components/runs/launch/base/branch-control";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { findLabelled } from "#support/dom-queries";
import { readyLaunchTarget } from "#support/launch-target";
import { mount } from "#support/mount";

const MANY_BRANCHES = [
  "main",
  "develop",
  ...Array.from({ length: 40 }, (_, index) => `feat/topic-${index}`),
  "Fix/Login-Redirect",
];

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

async function render(target = readyLaunchTarget()) {
  const mounted = await mount(<BaseBranchControl target={target} />);
  cleanups.push(mounted.cleanup);
  return mounted;
}

function localBaseCheckbox(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>("[role='checkbox']");
}

function options(): string[] {
  return [...document.body.querySelectorAll<HTMLElement>("[role='option']")].map(
    (option) => option.textContent?.trim() ?? "",
  );
}

function search(): HTMLInputElement {
  const input = findLabelled("Find branch");
  if (!(input instanceof HTMLInputElement)) throw new Error("the branch search is missing");
  return input;
}

async function press(element: HTMLElement, key: string): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

async function open() {
  const target = { ...readyLaunchTarget(), branches: MANY_BRANCHES };
  await render(target);
  const trigger = findLabelled(`Base branch: ${target.baseBranch}`);
  if (trigger === undefined) throw new Error("the base branch trigger is missing");
  await act(async () => trigger.click());
  return { trigger, target };
}

it("offers no local-base choice while the repository has a remote to read the base from", async () => {
  await render();

  expect(localBaseCheckbox()).toBeNull();
});

it("asks for the local base explicitly when the repository has no remote", async () => {
  const setLocalBase = vi.fn();
  const target = { ...readyLaunchTarget(), hasRemote: false, setLocalBase };
  await render(target);

  const checkbox = localBaseCheckbox();
  expect(checkbox?.getAttribute("aria-checked")).toBe("false");
  await act(async () => checkbox?.click());

  expect(setLocalBase).toHaveBeenCalledWith(true);
});

it("opens on the search with every loaded branch listed and the current one marked", async () => {
  await open();

  expect(document.activeElement).toBe(search());
  expect(options()).toEqual(MANY_BRANCHES);
  const selected = document.body.querySelector("[role='option'][aria-selected='true']");
  expect(selected?.textContent?.trim()).toBe("main");
});

it("filters the loaded list case-insensitively without touching the selection", async () => {
  const { target } = await open();

  await act(async () => setInputValue(search(), "LOGIN"));

  expect(options()).toEqual(["Fix/Login-Redirect"]);
  expect(target.setBaseBranch).not.toHaveBeenCalled();
});

it("says so when no branch matches", async () => {
  await open();

  await act(async () => setInputValue(search(), "release/"));

  expect(options()).toEqual([]);
  expect(document.body.textContent).toContain("No branch matches.");
});

it("finds and picks a branch with the keyboard alone", async () => {
  const { target } = await open();

  await act(async () => setInputValue(search(), "topic-3"));
  await press(search(), "ArrowDown");
  await press(search(), "ArrowDown");
  await press(search(), "Enter");

  expect(target.setBaseBranch).toHaveBeenCalledWith("feat/topic-30");
  expect(document.body.querySelector("[role='listbox']")).toBeNull();
});

it("closes on Escape and reopens on the full list", async () => {
  const { trigger, target } = await open();

  await act(async () => setInputValue(search(), "topic-1"));
  await press(search(), "Escape");
  expect(document.body.querySelector("[role='listbox']")).toBeNull();

  await act(async () => trigger.click());

  expect(search().value).toBe("");
  expect(options()).toEqual(MANY_BRANCHES);
  expect(target.setBaseBranch).not.toHaveBeenCalled();
});
