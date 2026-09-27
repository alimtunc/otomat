// @vitest-environment happy-dom
import { AppShell, AppSidebar } from "@otomat/ui";
import { act, useState } from "react";
import { afterEach, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <AppShell
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      sidebar={
        <AppSidebar>
          <details>
            <summary>Project</summary>Project views
          </details>
        </AppSidebar>
      }
    >
      content
    </AppShell>
  );
}
afterEach(async () => {
  await unmountAll();
  localStorage.clear();
});
it("keeps sidebar controls and their disclosure state mounted when toggling", async () => {
  const container = await render(<Shell />);
  const details = container.querySelector("details");
  const toggle = container.querySelector<HTMLButtonElement>('button[aria-controls="sidebar"]');
  if (details === null || toggle === null) throw new Error("Sidebar controls missing");
  details.open = true;
  await act(async () => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  await act(async () => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelector("details")).toBe(details);
  expect(details.open).toBe(true);
  expect(container.querySelector('button[aria-controls="sidebar"]')).toBe(toggle);
});
