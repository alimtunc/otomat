import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import type { LiveInputItem } from "#runtime";
import {
  appendLiveInput,
  clearLiveInput,
  createLiveInputChannel,
  liveInputIds,
  liveInputReceipts,
} from "#supervisor/live-input";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "otomat-live-input-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Reads the channel until it has yielded `count` messages, then stops taking input exactly as a finished turn does. */
async function take(count: number): Promise<LiveInputItem[]> {
  const controller = new AbortController();
  const taken: LiveInputItem[] = [];
  for await (const message of createLiveInputChannel(dir).items(controller.signal)) {
    taken.push(message);
    if (taken.length === count) controller.abort();
  }
  return taken;
}

it("hands the worker every message in the order the daemon appended them", async () => {
  appendLiveInput(dir, { kind: "message", id: "c1", body: "first" });
  appendLiveInput(dir, { kind: "message", id: "c2", body: "second" });

  expect(await take(2)).toEqual([
    { kind: "message", id: "c1", body: "first" },
    { kind: "message", id: "c2", body: "second" },
  ]);
});

it("yields a message appended after the turn started, without replaying the ones before it", async () => {
  appendLiveInput(dir, { kind: "message", id: "c1", body: "first" });
  const reader = take(2);
  appendLiveInput(dir, { kind: "message", id: "c2", body: "second" });

  expect((await reader).map((message) => message.id)).toEqual(["c1", "c2"]);
});

it("reads an untouched channel as empty rather than broken", () => {
  expect(liveInputIds(dir)).toEqual(new Set());
  expect(liveInputReceipts(dir)).toEqual(new Map());
});

it("records what stdin did with each message, accepted or refused", () => {
  const channel = createLiveInputChannel(dir);
  appendLiveInput(dir, { kind: "message", id: "c1", body: "first" });
  appendLiveInput(dir, { kind: "message", id: "c2", body: "second" });

  channel.wrote("c1", null);
  channel.wrote("c2", "write after end");

  expect(liveInputIds(dir)).toEqual(new Set(["c1", "c2"]));
  expect(liveInputReceipts(dir)).toEqual(
    new Map([
      ["c1", null],
      ["c2", "write after end"],
    ]),
  );
});

it("drops the previous turn's channel so the next one never replays it", async () => {
  appendLiveInput(dir, { kind: "message", id: "c1", body: "first" });
  createLiveInputChannel(dir).wrote("c1", null);

  clearLiveInput(dir);
  appendLiveInput(dir, { kind: "message", id: "c2", body: "second" });

  expect(liveInputReceipts(dir)).toEqual(new Map());
  expect(await take(1)).toEqual([{ kind: "message", id: "c2", body: "second" }]);
});
