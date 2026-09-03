import { expect, it } from "vitest";

import { localWorkLines } from "#main/background/work-lines";

it("names each count once, singular or plural", () => {
  expect(localWorkLines({ active: 1, waiting: 0, failed: 2 })).toEqual([
    "1 run active",
    "0 awaiting you",
    "2 failed",
  ]);
});

it("says the activity is unreadable rather than reporting a count it does not have", () => {
  expect(localWorkLines(null)).toEqual(["Otomat could not read the local daemon's activity."]);
});
