import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import { combineFailures } from "./failure-composition.js";
import { redactLogText } from "./redaction.js";

export interface RotatingLogOptions {
  maxBytes: number;
  archives: number;
}

function boundedEntry(value: string, maxBytes: number): Buffer {
  const entry = Buffer.from(`${redactLogText(value).trimEnd()}\n`, "utf8");
  if (entry.byteLength <= maxBytes) return entry;
  return Buffer.concat([
    Buffer.from("[TRUNCATED] ", "utf8"),
    entry.subarray(Math.max(0, entry.byteLength - maxBytes + 12)),
  ]).subarray(0, maxBytes);
}

function existingLogBytes(path: string): number {
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (stats === undefined) return 0;
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Managed log path ${path} must be a regular file.`);
  }
  return stats.size;
}

/** The archive slot must be a regular file before rotation unlinks or renames it. */
function assertRegularLogFile(path: string): void {
  existingLogBytes(path);
}

function appendLogEntry(path: string, entry: Buffer): void {
  const descriptor = openSync(
    path,
    constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
    0o600,
  );
  const failures: unknown[] = [];
  try {
    if (!fstatSync(descriptor).isFile()) {
      throw new Error(`Managed log path ${path} must be a regular file.`);
    }
    writeFileSync(descriptor, entry);
  } catch (error) {
    failures.push(error);
  }
  try {
    closeSync(descriptor);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw combineFailures(failures, "Log append and handle cleanup both failed.");
  }
}

function readLogFile(path: string): string {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let contents = "";
  const failures: unknown[] = [];
  try {
    if (!fstatSync(descriptor).isFile()) {
      throw new Error(`Managed log path ${path} must be a regular file.`);
    }
    contents = readFileSync(descriptor, "utf8");
  } catch (error) {
    failures.push(error);
  }
  try {
    closeSync(descriptor);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw combineFailures(failures, "Log read and handle cleanup both failed.");
  }
  return contents;
}

export class RotatingLog {
  constructor(
    readonly path: string,
    private readonly options: RotatingLogOptions,
  ) {}

  write(value: string): void {
    const entry = boundedEntry(value, this.options.maxBytes);
    const currentBytes = existingLogBytes(this.path);
    if (currentBytes + entry.byteLength > this.options.maxBytes) this.rotate();
    appendLogEntry(this.path, entry);
  }

  read(): string {
    const parts: string[] = [];
    for (let archive = this.options.archives; archive >= 1; archive -= 1) {
      const path = `${this.path}.${archive}`;
      if (existingLogBytes(path) > 0) parts.push(readLogFile(path));
    }
    if (existingLogBytes(this.path) > 0) parts.push(readLogFile(this.path));
    return redactLogText(parts.join(""));
  }

  private rotate(): void {
    if (this.options.archives === 0) {
      rmSync(this.path, { force: true });
      return;
    }
    const lastArchive = `${this.path}.${this.options.archives}`;
    assertRegularLogFile(lastArchive);
    rmSync(lastArchive, { force: true });
    for (let archive = this.options.archives - 1; archive >= 1; archive -= 1) {
      const source = `${this.path}.${archive}`;
      if (existingLogBytes(source) > 0) renameSync(source, `${this.path}.${archive + 1}`);
    }
    if (existingLogBytes(this.path) > 0) renameSync(this.path, `${this.path}.1`);
  }
}
