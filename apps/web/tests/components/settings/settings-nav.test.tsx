// @vitest-environment happy-dom
import { SettingsNav } from "@web/components/settings/settings-nav";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
  useMatchRoute: () => () => false,
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

async function renderNav(): Promise<Mounted> {
  const mounted = await mount(<SettingsNav />);
  cleanups.push(mounted.cleanup);
  return mounted;
}

function groupOf(container: HTMLElement, label: string): string[] {
  const group = [...container.querySelectorAll("div")].find(
    (element) => element.firstElementChild?.textContent === label,
  );
  return [...(group?.querySelectorAll("a") ?? [])].map((link) => link.textContent ?? "");
}

it("separates what belongs to the project, the machine, and reference material", async () => {
  const { container } = await renderNav();

  expect(groupOf(container, "Project")).toEqual(["This project"]);
  expect(groupOf(container, "Global")).toContain("Agents");
  expect(groupOf(container, "Global")).toContain("Skills");
  expect(groupOf(container, "Reference")).toEqual(["Runtimes", "About · Daemon", "Design system"]);
});

it("keeps the design system reachable as the document it is", async () => {
  const { container } = await renderNav();

  const gallery = [...container.querySelectorAll("a")].find(
    (link) => link.textContent === "Design system",
  );
  expect(gallery?.getAttribute("href")).toBe("/gallery.html");
});
