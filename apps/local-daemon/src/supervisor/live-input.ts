import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { readCompleteLinesFrom, type TailRead } from "#events";
import { asString, parseJsonRecord, type LiveInputChannel, type LiveInputMessage } from "#runtime";

import { delay } from "./delay.js";
import { errorCode } from "./start-gate.js";

/**
 * Daemon↔worker live steering channel as two append-only session-dir files
 * (daemon: persisted messages; worker: what stdin took) — on disk, not in memory,
 * so a daemon restart reconciles a claim from the evidence the delivery awaited.
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

function toMessage(line: string): LiveInputMessage | null {
  const record = parseJsonRecord(line);
  const id = asString(record?.["id"]);
  const body = asString(record?.["body"]);
  return id === null || body === null ? null : { id, body };
}

/** Drops the previous turn's channel so a new one never replays messages an earlier turn already took. */
export function clearLiveInput(sessionDir: string): void {
  rmSync(inboxPath(sessionDir), { force: true });
  rmSync(receiptsPath(sessionDir), { force: true });
}

/** Hands one already-persisted message to the running worker, in the `seq` order the provider reads it. */
export function appendLiveInput(sessionDir: string, message: LiveInputMessage): void {
  mkdirSync(sessionDir, { recursive: true });
  appendFileSync(inboxPath(sessionDir), `${JSON.stringify(message)}\n`);
}

/** The ids this session's channel was asked to carry, so a claim's proof is its receipt rather than the turn's start gate. */
export function liveInputIds(sessionDir: string): Set<string> {
  const ids = readLinesFrom(inboxPath(sessionDir), 0).lines.map((line) => toMessage(line)?.id);
  return new Set(ids.filter((id): id is string => id !== undefined));
}

/** What stdin did with each message the worker read: absent means it never got that far, `null` means it was accepted. */
export function liveInputReceipts(sessionDir: string): Map<string, string | null> {
  const receipts = new Map<string, string | null>();
  for (const line of readLinesFrom(receiptsPath(sessionDir), 0).lines) {
    const record = parseJsonRecord(line);
    const id = asString(record?.["id"]);
    if (id !== null) receipts.set(id, asString(record?.["error"]));
  }
  return receipts;
}

/** The worker's side: it tails the inbox for as long as the turn accepts input, and records what stdin did with each message. */
export function createLiveInputChannel(sessionDir: string): LiveInputChannel {
  return {
    async *messages(signal: AbortSignal): AsyncIterable<LiveInputMessage> {
      let offset = 0;
      while (!signal.aborted) {
        const { lines, consumedBytes } = readLinesFrom(inboxPath(sessionDir), offset);
        offset += consumedBytes;
        for (const line of lines) {
          const message = toMessage(line);
          if (message !== null) yield message;
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
