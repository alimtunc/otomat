import { isExplicitTestCommand, type EventEnvelope } from "@otomat/domain";
import { asNumber, asString } from "@web/lib/coerce";

export interface TestEvidence {
  id: string;
  command: string;
  outcome: "running" | "completed" | "passed" | "failed";
  exitCode: number | null;
  output: string | null;
}

const COMMAND_TOOLS = new Set(["bash", "command_execution"]);

function commandFromArgs(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("command" in value)) return null;
  return asString(value.command);
}

function exitCodeFromResult(value: unknown): number | null {
  if (typeof value !== "object" || value === null || !("exit_code" in value)) return null;
  return asNumber(value.exit_code);
}

function outputFromResult(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const lines = value.flatMap((entry) => outputFromResult(entry) ?? []);
    return lines.length > 0 ? lines.join("\n") : null;
  }
  if (typeof value !== "object" || value === null) return null;
  if ("output" in value) return asString(value.output);
  if ("text" in value) return asString(value.text);
  return null;
}

function testOutcome(
  resultEvent: EventEnvelope | undefined,
  exitCode: number | null,
): TestEvidence["outcome"] {
  if (!resultEvent) return "running";
  if (resultEvent.payload["is_error"] === true || (exitCode !== null && exitCode !== 0)) {
    return "failed";
  }
  return exitCode === 0 ? "passed" : "completed";
}

export function collectTestEvidence(events: readonly EventEnvelope[]): TestEvidence[] {
  const resultEventsByToolUseId = new Map<string, EventEnvelope>();
  for (const event of events) {
    const toolUseId = asString(event.payload["tool_use_id"]);
    if (event.type === "runtime.tool_call" && event.payload["phase"] === "result" && toolUseId) {
      resultEventsByToolUseId.set(toolUseId, event);
    }
  }
  return events.flatMap((event) => {
    if (event.type !== "runtime.tool_call" || event.payload["phase"] !== "call") return [];
    const tool = asString(event.payload["tool"])?.toLowerCase();
    if (!tool || !COMMAND_TOOLS.has(tool)) return [];
    const command = commandFromArgs(event.payload["args"]);
    if (!command || !isExplicitTestCommand(command)) return [];
    const toolUseId = asString(event.payload["tool_use_id"]);
    const resultEvent = toolUseId ? resultEventsByToolUseId.get(toolUseId) : undefined;
    const exitCode = exitCodeFromResult(resultEvent?.payload["result"]);
    return [
      {
        id: event.id,
        command,
        outcome: testOutcome(resultEvent, exitCode),
        exitCode,
        output: outputFromResult(resultEvent?.payload["result"]),
      },
    ];
  });
}
