// @vitest-environment happy-dom

import { SettingsNav } from "@web/components/settings/settings-nav";
import { hostOwnedSettingsRoutes } from "@web/components/settings/settings-nav-groups";
import { activeHostStore } from "@web/lib/active-host";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { mount, type Mounted } from "#support/mount";

let currentRoute = "/settings/appearance";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useMatchRoute:
    () =>
    ({ to, fuzzy }: { to: string; fuzzy?: boolean }) =>
      fuzzy === false ? currentRoute === to : currentRoute.startsWith(to),
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  currentRoute = "/settings/appearance";
  activeHostStore.setState(() => null);
  delete window.otomat;
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

it("groups every screen by what owns it, naming the daemon the global one belongs to", async () => {
  const { container } = await renderNav();

  expect(groupOf(container, "Project")).toEqual(["This project", "Agents", "Skills"]);
  expect(groupOf(container, "Global · Local")).toEqual([
    "Agents",
    "Skills",
    "Execution defaults",
    "Workflow presets",
  ]);
  expect(groupOf(container, "All hosts")).toEqual([
    "Repositories",
    "Workspaces",
    "Execution hosts",
    "Integrations",
    "Appearance",
  ]);
  expect(groupOf(container, "Reference")).toEqual(["Runtimes", "About · Daemon", "Design system"]);
});

it("renames the global group after a host switch instead of implying one shared catalog", async () => {
  window.otomat = fakeDesktopBridge({ executionHostSshAlias: "otomat-vps" });
  activeHostStore.setState(() => ({ id: "remote", daemonUrl: "http://127.0.0.1:45010" }));
  const { container } = await renderNav();

  expect(groupOf(container, "Global · otomat-vps")).toContain("Agents");
  expect(groupOf(container, "Global · Local")).toEqual([]);
});

it("leaves the sandbox out of what the displayed daemon owns, since a reset only wipes the local one", async () => {
  window.otomat = fakeDesktopBridge({ preview: true });
  const { container } = await renderNav();

  expect(groupOf(container, "All hosts")).toContain("Sandbox");
  expect(groupOf(container, "Global · Local")).not.toContain("Sandbox");
  expect(hostOwnedSettingsRoutes()).not.toContain("/settings/sandbox");
});

it("gives a project sub-page the highlight instead of its parent entry", async () => {
  currentRoute = "/settings/project/agents";
  const { container } = await renderNav();

  const current = [...container.querySelectorAll("a")]
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.getAttribute("href"));
  expect(current).toEqual(["/settings/project/agents"]);
});

it("keeps the design system reachable as the document it is", async () => {
  const { container } = await renderNav();

  const gallery = [...container.querySelectorAll("a")].find(
    (link) => link.textContent === "Design system",
  );
  expect(gallery?.getAttribute("href")).toBe("/gallery.html");
});
