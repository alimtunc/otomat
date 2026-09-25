import { createRequire } from "node:module";

import { appendTerminalFrame, finishTerminalRecord, type Db } from "@otomat/db";
import type { TerminalSession } from "@otomat/domain";
import type { IPty } from "node-pty";

import { providerProcessEnv } from "#runtime/cli/environment";

import { TerminalRefusedError } from "./errors.js";

export class UserTerminal {
  private readonly pty: IPty;
  private readonly frames: { seq: number; data: string }[] = [];
  private seq = 0;
  private bytes = 0;
  private readonly ended: Promise<void>;
  private recordingError: Error | null = null;

  constructor(
    readonly info: TerminalSession,
    file: string,
    args: string[],
    release: () => void,
    db: Db,
  ) {
    const ptyModule: typeof import("node-pty") = createRequire(import.meta.url)("node-pty");
    this.pty = ptyModule.spawn(file, args, {
      cwd: info.path,
      cols: 80,
      rows: 24,
      name: "xterm-256color",
      env: providerProcessEnv(),
    });
    this.pty.onData((data) => {
      this.frames.push({ seq: ++this.seq, data });
      this.bytes += Buffer.byteLength(data);
      while (this.bytes > 262144 && this.frames.length > 1) {
        const first = this.frames.shift();
        if (first) this.bytes -= Buffer.byteLength(first.data);
      }
      try {
        appendTerminalFrame(db, info.id, this.seq, data, this.frames[0]?.seq ?? this.seq);
      } catch (error) {
        this.recordingError = error instanceof Error ? error : new Error(String(error));
        this.pty.kill("SIGKILL");
      }
    });
    this.ended = new Promise((resolve) => {
      this.pty.onExit(({ exitCode, signal }) => {
        info.state = "exited";
        info.exit_code = exitCode;
        info.signal = signal ?? null;
        try {
          finishTerminalRecord(db, info);
        } catch (error) {
          this.recordingError = error instanceof Error ? error : new Error(String(error));
        } finally {
          release();
          resolve();
        }
      });
    });
  }

  output(after: number) {
    this.checkRecording();
    return {
      session: this.info,
      cursor: this.seq,
      truncated: after < (this.frames[0]?.seq ?? 1) - 1,
      data: this.frames
        .filter((frame) => frame.seq > after)
        .map((frame) => frame.data)
        .join(""),
    };
  }

  write(data: string): void {
    this.checkRecording();
    if (this.info.state !== "running")
      throw new TerminalRefusedError("The terminal session has ended.");
    this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    this.checkRecording();
    if (this.info.state !== "running")
      throw new TerminalRefusedError("The terminal session has ended.");
    this.pty.resize(cols, rows);
  }

  private checkRecording(): void {
    if (this.recordingError !== null)
      throw new Error(
        "Terminal recording failed. The session was stopped to preserve its saved output.",
        { cause: this.recordingError },
      );
  }

  async close(): Promise<void> {
    if (this.info.state !== "running") {
      await this.ended;
      this.checkRecording();
      return;
    }
    this.info.state = "closing";
    this.pty.kill("SIGHUP");
    const timer = setTimeout(() => this.pty.kill("SIGKILL"), 1500);
    try {
      await this.ended;
      this.checkRecording();
    } finally {
      clearTimeout(timer);
    }
  }
}
