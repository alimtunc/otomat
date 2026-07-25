import type { ChildProcess } from "node:child_process";

import type { DesktopStartupDiagnostic } from "@otomat/domain";

import { RedactedLineBuffer } from "./redacted-line-buffer.js";
import { parseStartupDiagnosticLine } from "./startup-diagnostic.js";

type OutputStream = "stderr" | "stdout";

export class DaemonOutputCapture {
  private readonly buffers = {
    stdout: new RedactedLineBuffer(),
    stderr: new RedactedLineBuffer(),
  };
  private readonly listeners: Partial<Record<OutputStream, (chunk: string) => void>> = {};
  private reportedLogFailure = false;
  diagnostic: DesktopStartupDiagnostic | null = null;

  constructor(private readonly writeLog?: (stream: OutputStream, text: string) => void) {}

  attach(child: ChildProcess): Promise<number | null> {
    for (const stream of ["stdout", "stderr"] as const) {
      const output = child[stream];
      if (output === null) continue;
      output.setEncoding("utf8");
      const listener = (chunk: string): void => this.handle(stream, chunk);
      this.listeners[stream] = listener;
      output.on("data", listener);
    }
    return new Promise((resolve) => {
      child.once("close", (code) => {
        this.detachAndFlush(child);
        resolve(code);
      });
    });
  }

  detachAndFlush(child: ChildProcess): void {
    for (const stream of ["stdout", "stderr"] as const) {
      const listener = this.listeners[stream];
      if (listener !== undefined) child[stream]?.off("data", listener);
      delete this.listeners[stream];
      for (const line of this.buffers[stream].flush()) this.consume(stream, line);
    }
  }

  private handle(stream: OutputStream, raw: string): void {
    for (const line of this.buffers[stream].push(raw)) this.consume(stream, line);
  }

  private consume(stream: OutputStream, line: { raw: string | null; safe: string | null }): void {
    if (stream === "stderr" && line.raw !== null) {
      const parsed = parseStartupDiagnosticLine(line.raw.trimEnd());
      if (parsed.kind === "valid") {
        this.diagnostic = parsed.diagnostic;
      } else if (parsed.kind === "invalid") {
        this.write("stderr", "Invalid structured startup diagnostic was ignored.\n");
      }
    }
    if (line.safe !== null) this.write(stream, line.safe);
  }

  private write(stream: OutputStream, safe: string): void {
    if (this.writeLog !== undefined) {
      try {
        this.writeLog(stream, safe);
      } catch {
        if (!this.reportedLogFailure) {
          this.reportedLogFailure = true;
          console.error("[otomat-desktop] daemon log write failed");
        }
      }
      return;
    }
    const output = stream === "stdout" ? process.stdout : process.stderr;
    output.write(`[daemon] ${safe}`);
  }
}
