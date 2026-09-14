// @vitest-environment happy-dom
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@otomat/domain";
import { NotificationsSection } from "@web/components/settings/notifications/section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
});

it("keeps generic copy by default, saves edited categories, and exposes a save failure", async () => {
  const bridge = fakeDesktopBridge();
  const save = vi.fn(bridge.notifications.save);
  bridge.notifications.save = save;
  window.otomat = bridge;
  cleanups.push((await mountWithQuery(<NotificationsSection />)).cleanup);
  const category = document.querySelector<HTMLButtonElement>(
    '[role="switch"][aria-label="Permission or choice requested"]',
  );
  const detail = document.querySelector<HTMLButtonElement>(
    '[role="switch"][aria-label="Show category"]',
  );
  expect(detail?.getAttribute("aria-checked")).toBe("false");
  await act(async () => {
    category?.click();
  });
  await act(async () => {
    findButton("Save notifications")?.click();
  });
  expect(save).toHaveBeenCalledWith({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    categories: { ...DEFAULT_NOTIFICATION_PREFERENCES.categories, permission: false },
  });
  save.mockRejectedValueOnce(new Error("Preferences could not be saved."));
  await act(async () => {
    detail?.click();
  });
  await act(async () => {
    findButton("Save notifications")?.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(document.body.textContent).toContain("Preferences could not be saved.");
});

it("exposes native delivery failures and opens only the system settings action", async () => {
  const bridge = fakeDesktopBridge();
  bridge.notifications.snapshot = async () => ({
    preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    delivery: "failed",
    error: "macOS could not deliver a notification. Check System Settings.",
  });
  bridge.notifications.openSettings = vi.fn(async () => {});
  window.otomat = bridge;
  cleanups.push((await mountWithQuery(<NotificationsSection />)).cleanup);
  expect(document.body.textContent).toContain("macOS could not deliver a notification");
  await act(async () => {
    findButton("Open macOS settings")?.click();
  });
  expect(bridge.notifications.openSettings).toHaveBeenCalledOnce();
});
