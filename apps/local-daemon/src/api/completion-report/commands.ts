import {
  isExplicitTestCommand,
  type EventEnvelope,
  type RunCompletionReport,
} from "@otomat/domain";

const COMMAND_TOOLS = new Set(["bash", "command_execution"]);

function stringProperty(value: unknown, property: string): string | null {
  if (typeof value !== "object" || value === null || !(property in value)) return null;
  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function numberProperty(value: unknown, property: string): number | null {
  if (typeof value !== "object" || value === null || !(property in value)) return null;
  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === "number" && Number.isInteger(candidate) ? candidate : null;
}

function commandOutcome(
  result: EventEnvelope | undefined,
  exitCode: number | null,
): RunCompletionReport["commands"][number]["outcome"] {
  if (!result) return "running";
  if (result.payload["is_error"] === true || (exitCode !== null && exitCode !== 0)) return "failed";
  if (exitCode === 0) return "passed";
  return "completed";
}

export function collectReportedCommands(
  events: readonly EventEnvelope[],
): RunCompletionReport["commands"] {
  const results = new Map<string | null, Map<string, EventEnvelope>>();
  for (const event of events) {
    const toolUseId = stringProperty(event.payload, "tool_use_id");
    if (event.type === "runtime.tool_call" && event.payload["phase"] === "result" && toolUseId) {
      const sessionResults =
        results.get(event.agent_session_id) ?? new Map<string, EventEnvelope>();
      sessionResults.set(toolUseId, event);
      results.set(event.agent_session_id, sessionResults);
    }
  }

  return events.flatMap((event) => {
    if (event.type !== "runtime.tool_call" || event.payload["phase"] !== "call") return [];
    const tool = stringProperty(event.payload, "tool")?.toLowerCase();
    if (!tool || !COMMAND_TOOLS.has(tool)) return [];
    const command = stringProperty(event.payload["args"], "command");
    if (!command) return [];
    const toolUseId = stringProperty(event.payload, "tool_use_id");
    const result = toolUseId ? results.get(event.agent_session_id)?.get(toolUseId) : undefined;
    const exitCode = numberProperty(result?.payload["result"], "exit_code");
    return [
      {
        id: event.id,
        command,
        kind: isExplicitTestCommand(command) ? ("test" as const) : ("command" as const),
        outcome: commandOutcome(result, exitCode),
        exit_code: exitCode,
        evidence: [
          ...(result ? [{ source: "timeline" as const, seq: result.seq }] : []),
          { source: "timeline" as const, seq: event.seq },
        ],
      },
    ];
  });
}
