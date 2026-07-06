import { asNumber, asRecord, asString } from "#runtime/cli/frame-guards";
import type { ProviderFrameMapper, ProviderTurnOutcome } from "#runtime/cli/turn";
import type { TurnEmitter } from "#runtime/cli/turn-emitter";

type ItemFrameType = "item.started" | "item.completed" | "item.updated";

export class CodexFrameMapper implements ProviderFrameMapper {
  readonly outcome: ProviderTurnOutcome = {
    providerSessionId: null,
    usage: null,
    result: null,
  };

  constructor(private readonly emitter: TurnEmitter) {}

  onFrame(frame: Record<string, unknown>): void {
    const type = asString(frame["type"]);
    if (type === "thread.started") {
      this.onThreadStarted(frame);
      return;
    }
    if (type === "item.started" || type === "item.completed" || type === "item.updated") {
      this.onItemFrame(type, frame);
      return;
    }
    if (type === "turn.completed") {
      this.onTurnCompleted(frame);
      return;
    }
    if (type === "turn.failed" || type === "error") {
      this.onTurnFailed(frame);
      return;
    }
    this.emitter.emit("runtime.log", "native", { frame });
  }

  private onThreadStarted(frame: Record<string, unknown>): void {
    this.outcome.providerSessionId = asString(frame["thread_id"]) ?? this.outcome.providerSessionId;
    this.emitter.emit("runtime.provider_session", "native", {
      provider_session_id: this.outcome.providerSessionId,
      frame,
    });
  }

  private onTurnCompleted(frame: Record<string, unknown>): void {
    const usage = asRecord(frame["usage"]);
    const inputTokens = asNumber(usage?.["input_tokens"]) ?? 0;
    const outputTokens = asNumber(usage?.["output_tokens"]) ?? 0;
    // Codex reports token usage but neither model nor cost — those stay null rather than invented.
    this.outcome.usage = {
      model: null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost_usd: null,
    };
    this.emitter.emit("runtime.usage", "native", { usage: this.outcome.usage, frame });
    this.outcome.result = { isError: false, message: null };
  }

  private onTurnFailed(frame: Record<string, unknown>): void {
    const error = asRecord(frame["error"]);
    this.outcome.result = {
      isError: true,
      message: asString(error?.["message"]) ?? asString(frame["message"]) ?? "codex turn failed",
    };
    this.emitter.emit("runtime.log", "native", { frame });
  }

  private onItemFrame(frameType: ItemFrameType, frame: Record<string, unknown>): void {
    const item = asRecord(frame["item"]);
    if (item === null) {
      this.emitter.emit("runtime.log", "native", { frame });
      return;
    }
    const itemType = asString(item["type"]);
    const itemId = asString(item["id"]);

    if (itemType === "agent_message" || itemType === "reasoning") {
      // Messages stream via started/updated; only the completed item carries the final text once.
      if (frameType !== "item.completed") return;
      const text = asString(item["text"]);
      if (text !== null) {
        this.emitter.emit("runtime.message", "parsed", {
          role: "assistant",
          text,
          ...(itemType === "reasoning" ? { thinking: true } : {}),
        });
      }
      return;
    }
    if (itemType === "command_execution") {
      this.onCommandItem(frameType, item, itemId);
      return;
    }
    if (itemType === "file_change") {
      if (frameType !== "item.completed") return;
      this.emitter.emit("runtime.tool_call", "parsed", {
        phase: "result",
        tool: "file_change",
        tool_use_id: itemId,
        is_error: asString(item["status"]) === "failed",
        result: { changes: item["changes"] ?? null },
      });
      return;
    }
    // Unknown item types are preserved verbatim, never invented as successful tool results.
    if (frameType === "item.completed") {
      this.emitter.emit("runtime.log", "native", { frame });
    }
  }

  private onCommandItem(
    frameType: ItemFrameType,
    item: Record<string, unknown>,
    itemId: string | null,
  ): void {
    if (frameType === "item.started") {
      this.emitter.emit("runtime.tool_call", "parsed", {
        phase: "call",
        tool: "command_execution",
        tool_use_id: itemId,
        args: { command: asString(item["command"]) },
      });
      return;
    }
    if (frameType === "item.completed") {
      this.emitter.emit("runtime.tool_call", "parsed", {
        phase: "result",
        tool: "command_execution",
        tool_use_id: itemId,
        is_error: (asNumber(item["exit_code"]) ?? 0) !== 0,
        result: {
          exit_code: asNumber(item["exit_code"]),
          output: asString(item["aggregated_output"]),
        },
      });
    }
  }
}
