import { expect, it, vi } from "vitest";

const showMessageBox = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({ dialog: { showMessageBox } }));

import { askCloseChoice, confirmQuit } from "#main/background/prompts";

const LIVE = { active: 1, waiting: 2, failed: 0 };

function answered(response: number): void {
  showMessageBox.mockResolvedValueOnce({ response });
}

it("maps each close button to the choice it offers, and an unknown answer to cancel", async () => {
  answered(0);
  expect(await askCloseChoice(LIVE)).toBe("background");
  answered(1);
  expect(await askCloseChoice(LIVE)).toBe("quit");
  answered(2);
  expect(await askCloseChoice(LIVE)).toBe("cancel");
  answered(9);
  expect(await askCloseChoice(LIVE)).toBe("cancel");
});

it("defaults the close to keeping the runs going and cancels on dismissal", async () => {
  answered(0);

  await askCloseChoice(LIVE);

  const [options] = showMessageBox.mock.calls.at(-1) ?? [];
  expect(options).toMatchObject({
    buttons: ["Keep Running in Background", "Stop Runs and Quit", "Cancel"],
    defaultId: 0,
    cancelId: 2,
  });
});

it("names the work a quit would interrupt without naming the issues behind it", async () => {
  answered(0);

  expect(await confirmQuit(LIVE)).toBe(true);

  const [options] = showMessageBox.mock.calls.at(-1) ?? [];
  expect(options.detail).toContain("1 run active");
  expect(options.detail).toContain("2 awaiting you");
  expect(options).toMatchObject({ buttons: ["Quit Otomat", "Cancel"], defaultId: 1, cancelId: 1 });
});

it("treats anything but the quit button as declining the quit", async () => {
  answered(1);

  expect(await confirmQuit(LIVE)).toBe(false);
});

it("says the state is unreadable rather than reporting counts it does not have", async () => {
  answered(2);

  await askCloseChoice(null);

  const [options] = showMessageBox.mock.calls.at(-1) ?? [];
  expect(options.detail).toContain("could not read the local daemon's activity");
});
