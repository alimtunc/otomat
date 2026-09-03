import { expect, it, vi } from "vitest";

import { CockpitWindow } from "#main/cockpit-window";

function fakeWindow() {
  const listeners = new Map<string, (event: { preventDefault(): void }) => void>();
  const window = {
    on: vi.fn((event: string, listener: (event: { preventDefault(): void }) => void) => {
      listeners.set(event, listener);
    }),
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    webContents: { isDestroyed: vi.fn(() => false), send: vi.fn(), reload: vi.fn() },
  };
  const close = () => {
    const event = { preventDefault: vi.fn() };
    listeners.get("close")?.(event);
    if (event.preventDefault.mock.calls.length === 0) listeners.get("closed")?.(event);
    return event;
  };
  return { window, close };
}

it("holds the close while the operator has not answered, keeping the renderer alive", () => {
  const fake = fakeWindow();
  const cockpit = new CockpitWindow({ create: () => fake.window, onClose: () => true });
  cockpit.open();

  const event = fake.close();

  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(cockpit.isOpen).toBe(true);
});

it("lets the close through once nothing holds it any more", () => {
  const fake = fakeWindow();
  const cockpit = new CockpitWindow({ create: () => fake.window, onClose: () => false });
  cockpit.open();

  const event = fake.close();

  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(cockpit.isOpen).toBe(false);
});

it("reopens the very same window it hid, rather than building a second one", () => {
  const fake = fakeWindow();
  const create = vi.fn(() => fake.window);
  const cockpit = new CockpitWindow({ create, onClose: () => true });

  cockpit.open();
  cockpit.hide();
  cockpit.open();

  expect(create).toHaveBeenCalledOnce();
  expect(fake.window.hide).toHaveBeenCalledOnce();
  expect(fake.window.show).toHaveBeenCalledOnce();
  expect(fake.window.focus).toHaveBeenCalledOnce();
});

it("de-miniaturizes the window before focusing it", () => {
  const fake = fakeWindow();
  fake.window.isMinimized.mockReturnValue(true);
  const cockpit = new CockpitWindow({ create: () => fake.window, onClose: () => true });

  cockpit.open();
  cockpit.show();

  expect(fake.window.restore).toHaveBeenCalledOnce();
});

it("drops a message to a renderer that is already gone", () => {
  const fake = fakeWindow();
  fake.window.webContents.isDestroyed.mockReturnValue(true);
  const cockpit = new CockpitWindow({ create: () => fake.window, onClose: () => true });
  cockpit.open();

  cockpit.send("channel", "payload");

  expect(fake.window.webContents.send).not.toHaveBeenCalled();
});
