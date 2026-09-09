import { expect, it, vi } from "vitest";

const showMessageBox = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({ dialog: { showMessageBox } }));

import { askCloseChoice } from "#main/background/prompts";
import type { LocalWorkItem } from "#main/background/work-items";

const LIVE: LocalWorkItem[] = [
  { run_id: "run-a", project: "Otomat", issue: "OTO-1", state: "running", started_at: null },
  { run_id: "run-b", project: "Otomat", issue: "OTO-2", state: "waiting", started_at: null },
];

function answered(response: number): void {
  showMessageBox.mockResolvedValueOnce({ response });
}

it("maps each button to the choice it offers, and an unknown answer to cancel", async () => {
  answered(0);
  expect(await askCloseChoice(LIVE, "/tmp/app-icon.png")).toBe("background");
  answered(1);
  expect(await askCloseChoice(LIVE, "/tmp/app-icon.png")).toBe("quit");
  answered(2);
  expect(await askCloseChoice(LIVE, "/tmp/app-icon.png")).toBe("cancel");
  answered(9);
  expect(await askCloseChoice(LIVE, "/tmp/app-icon.png")).toBe("cancel");
});

it("offers the background first, names the work at stake, and cancels on dismissal", async () => {
  answered(0);

  await askCloseChoice(LIVE, "/tmp/app-icon.png");

  const [options] = showMessageBox.mock.calls.at(-1) ?? [];
  expect(options).toMatchObject({
    buttons: ["Keep Running in Background", "Stop Runs and Quit", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    icon: "/tmp/app-icon.png",
  });
  expect(options.detail).toContain("1 run active");
  expect(options.detail).toContain("1 awaiting you");
});

it("names no issue, no prompt and no conversation in the system dialog", async () => {
  answered(0);

  await askCloseChoice(LIVE, "/tmp/app-icon.png");

  const [options] = showMessageBox.mock.calls.at(-1) ?? [];
  expect(`${options.message}${options.detail}`).not.toContain("OTO-1");
});

it("says the state is unreadable rather than reporting counts it does not have", async () => {
  answered(2);

  await askCloseChoice(null, "/tmp/app-icon.png");

  const [options] = showMessageBox.mock.calls.at(-1) ?? [];
  expect(options.detail).toContain("could not read the local daemon's activity");
});
