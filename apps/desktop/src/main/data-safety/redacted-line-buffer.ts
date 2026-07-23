import { splitLogText, withoutLineEnding } from "./log-lines.js";
import { redactLogText } from "./redaction.js";
import {
  advanceAuthorizationContinuation,
  type AuthorizationContinuation,
  scanSensitiveValues,
  type SensitiveValueState,
} from "./sensitive-value-scanner.js";

const MAX_PENDING_LINE_CHARACTERS = 64 * 1024;
const MAX_LEXICAL_CONTEXT_CHARACTERS = 512;
const TRUNCATED_LINE = "[TRUNCATED OUTPUT LINE]\n";

export interface RedactedOutputLine {
  raw: string | null;
  safe: string | null;
}

function appendLexicalContext(context: string, value: string): string {
  const normalized = `${context}${value.replace(/\s+/g, " ")}`.replace(/\s+/g, " ");
  return normalized.slice(-MAX_LEXICAL_CONTEXT_CHARACTERS);
}

export class RedactedLineBuffer {
  private pending = "";
  private lexicalContext = "";
  private discardingLongLine = false;
  private authorizationContinuation: AuthorizationContinuation = "none";
  private sensitiveState: SensitiveValueState | null = null;

  push(chunk: string): RedactedOutputLine[] {
    const outputLines: RedactedOutputLine[] = [];
    const split = splitLogText(`${this.pending}${chunk}`, false);
    this.pending = "";
    for (const segment of split.lines) {
      if (this.discardingLongLine) {
        this.consumeDiscardedSegment(segment, true);
        continue;
      }
      this.pending += segment;
      if (this.pending.length > MAX_PENDING_LINE_CHARACTERS) {
        outputLines.push({ raw: null, safe: TRUNCATED_LINE });
        this.beginDiscardingPendingLine(true);
        continue;
      }
      outputLines.push(this.redactCompletedLine(this.pending));
      this.pending = "";
    }
    if (split.remainder !== "") {
      if (this.discardingLongLine) {
        if (split.remainder.endsWith("\r")) {
          this.consumeDiscardedSegment(split.remainder.slice(0, -1), false);
          this.pending = "\r";
        } else {
          this.consumeDiscardedSegment(split.remainder, false);
        }
      } else {
        this.pending = split.remainder;
        if (this.pending.length > MAX_PENDING_LINE_CHARACTERS) {
          const hasProvisionalCarriageReturn = this.pending.endsWith("\r");
          if (hasProvisionalCarriageReturn) this.pending = this.pending.slice(0, -1);
          outputLines.push({ raw: null, safe: TRUNCATED_LINE });
          this.beginDiscardingPendingLine(false);
          if (hasProvisionalCarriageReturn) this.pending = "\r";
        }
      }
    }
    return outputLines;
  }

  flush(): RedactedOutputLine[] {
    if (this.discardingLongLine || this.pending === "") {
      this.reset();
      return [];
    }
    const output = this.redactCompletedLine(this.pending);
    this.reset();
    return [output];
  }

  private beginDiscardingPendingLine(lineComplete: boolean): void {
    const scan = scanSensitiveValues(withoutLineEnding(this.pending), this.sensitiveState);
    this.sensitiveState = scan.state;
    this.lexicalContext = scan.state === null ? appendLexicalContext("", scan.trailingText) : "";
    this.pending = "";
    this.discardingLongLine = !lineComplete;
    if (lineComplete) this.finishDiscardedLine();
  }

  private consumeDiscardedSegment(segment: string, lineComplete: boolean): void {
    const content = withoutLineEnding(segment);
    const scanInput =
      this.sensitiveState === null ? appendLexicalContext(this.lexicalContext, content) : content;
    const scan = scanSensitiveValues(scanInput, this.sensitiveState);
    this.sensitiveState = scan.state;
    this.lexicalContext = scan.state === null ? appendLexicalContext("", scan.trailingText) : "";
    if (!lineComplete) return;
    this.discardingLongLine = false;
    this.finishDiscardedLine();
  }

  private finishDiscardedLine(): void {
    if (this.sensitiveState === null) {
      this.authorizationContinuation = advanceAuthorizationContinuation(
        this.lexicalContext,
        this.authorizationContinuation,
      );
    }
    this.lexicalContext = "";
  }

  private redactCompletedLine(raw: string): RedactedOutputLine {
    const content = withoutLineEnding(raw);
    const continuingSensitiveValue = this.sensitiveState !== null;
    const suppressAuthorizationContinuation = this.authorizationContinuation !== "none";
    const scan = scanSensitiveValues(content, this.sensitiveState);
    this.sensitiveState = scan.state;
    this.authorizationContinuation = advanceAuthorizationContinuation(
      scan.trailingText,
      this.authorizationContinuation,
    );

    if (suppressAuthorizationContinuation) return { raw, safe: null };
    if (this.sensitiveState !== null) {
      return {
        raw,
        safe: continuingSensitiveValue ? null : "[REDACTED MULTILINE VALUE]\n",
      };
    }
    const safeSource = continuingSensitiveValue ? scan.trailingText : raw;
    return {
      raw,
      safe: safeSource.trim() === "" ? null : `${redactLogText(safeSource).trimEnd()}\n`,
    };
  }

  private reset(): void {
    this.pending = "";
    this.lexicalContext = "";
    this.discardingLongLine = false;
    this.authorizationContinuation = "none";
    this.sensitiveState = null;
  }
}
