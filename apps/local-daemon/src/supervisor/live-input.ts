import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { runtimeInteractionAnswerSchema } from "@otomat/domain";

import { readCompleteLinesFrom, type TailRead } from "#events";
import { asString, parseJsonRecord, type LiveInputChannel, type LiveInputItem } from "#runtime";

import { delay } from "./delay.js";
import { errorCode } from "./start-gate.js";

/**
 * Daemon↔worker channel into a running turn's stdin, as two append-only session-dir
 * files (daemon: persisted items; worker: what stdin took) — on disk, not in memory,
 * so a daemon restart reconciles a claim from the evidence the delivery awaited. It
 * carries both a steering message and an answer to a question the turn is blocked
 * on, because both are the daemon writing into the same open pipe.
 */
const INBOX_FILENAME = "live-input.jsonl";
const RECEIPTS_FILENAME = "live-input-receipts.jsonl";

const POLL_MS = 25;

function inboxPath(sessionDir: string): string {
  return join(sessionDir, INBOX_FILENAME);
}

function receiptsPath(sessionDir: string): string {
  return join(sessionDir, RECEIPTS_FILENAME);
}

/** A file the worker has not written yet is an empty channel, not a broken one. */
function readLinesFrom(path: string, offset: number): TailRead {
  try {
    return readCompleteLinesFrom(path, offset);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return { lines: [], consumedBytes: 0 };
    throw error;
  }
}

function toItem(line: string): LiveInputItem | null {
  const record = parseJsonRecord(line);
  const id = asString(record?.["id"]);
  if (record === null || id === null) return null;
  if (record["kind"] === "interaction_answer") {
    const requestId = asString(record["request_id"]);
    const answer = runtimeInteractionAnswerSchema.safeParse(record["answer"]);
    if (requestId === null || !answer.success) return null;
    return { kind: "interaction_answer", id, request_id: requestId, answer: answer.data };
  }
  const body = asString(record["body"]);
  return body === null ? null : { kind: "message", id, body };
}

/** Drops the previous turn's channel so a new one never replays messages an earlier turn already took. */
export function clearLiveInput(sessionDir: string): void {
  rmSync(inboxPath(sessionDir), { force: true });
  rmSync(receiptsPath(sessionDir), { force: true });
}

/** Hands one already-persisted item to the running worker, in the order the provider reads it. */
export function appendLiveInput(sessionDir: string, item: LiveInputItem): void {
  mkdirSync(sessionDir, { recursive: true });
  appendFileSync(inboxPath(sessionDir), `${JSON.stringify(item)}\n`);
}

/** The ids this session's channel was asked to carry, so a claim's proof is its receipt rather than the turn's start gate. */
export function liveInputIds(sessionDir: string): Set<string> {
  const ids = readLinesFrom(inboxPath(sessionDir), 0).lines.map((line) => toItem(line)?.id);
  return new Set(ids.filter((id): id is string => id !== undefined));
}

const RECEIPT_POLL_MS = 25;

/** Long enough for a worker between two inbox polls, short enough that a wedged one still frees the item for the next turn. */
const RECEIPT_TIMEOUT_MS = 10_000;

/** Waits for the worker's verdict on each id, giving up when the worker is gone or the window closes; a missing receipt is reported as absent, never as an acceptance. */
export async function awaitLiveInputReceipts(
  sessionDir: string,
  ids: readonly string[],
  exited: Promise<unknown>,
): Promise<{ receipts: Map<string, string | null>; workerGone: boolean }> {
  const deadline = Date.now() + RECEIPT_TIMEOUT_MS;
  let workerGone = false;
  void exited.then(() => {
    workerGone = true;
  });
  for (;;) {
    const receipts = liveInputReceipts(sessionDir);
    if (ids.every((id) => receipts.has(id))) return { receipts, workerGone };
    // One last read after the exit: the worker may have written a receipt on its way out.
    if (workerGone || Date.now() >= deadline) {
      return { receipts: liveInputReceipts(sessionDir), workerGone };
    }
    await delay(RECEIPT_POLL_MS);
  }
}

/** What stdin did with each item the worker read: absent means it never got that far, `null` means it was accepted. */
export function liveInputReceipts(sessionDir: string): Map<string, string | null> {
  const receipts = new Map<string, string | null>();
  for (const line of readLinesFrom(receiptsPath(sessionDir), 0).lines) {
    const record = parseJsonRecord(line);
    const id = asString(record?.["id"]);
    if (id !== null) receipts.set(id, asString(record?.["error"]));
  }
  return receipts;
}

/** The worker's side: it tails the inbox for as long as the turn accepts input, and records what stdin did with each item. */
export function createLiveInputChannel(sessionDir: string): LiveInputChannel {
  return {
    async *items(signal: AbortSignal): AsyncIterable<LiveInputItem> {
      let offset = 0;
      while (!signal.aborted) {
        const { lines, consumedBytes } = readLinesFrom(inboxPath(sessionDir), offset);
        offset += consumedBytes;
        for (const line of lines) {
          const item = toItem(line);
          if (item !== null) yield item;
        }
        if (lines.length === 0) await delay(POLL_MS);
      }
    },
    wrote(id: string, error: string | null): void {
      mkdirSync(sessionDir, { recursive: true });
      appendFileSync(receiptsPath(sessionDir), `${JSON.stringify({ id, error })}\n`);
    },
  };
}
