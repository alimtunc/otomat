import { asArray, asNumber, asRecord, asString } from "#runtime/cli/frame-guards";
import type { ProviderFrameMapper, ProviderTurnOutcome } from "#runtime/cli/turn";
import type { TurnEmitter } from "#runtime/cli/turn-emitter";

export class ClaudeFrameMapper implements ProviderFrameMapper {
  readonly outcome: ProviderTurnOutcome = {
    providerSessionId: null,
    usage: null,
    result: null,
  };

  private model: string | null = null;

  constructor(private readonly emitter: TurnEmitter) {}

  onFrame(frame: Record<string, unknown>): void {
    const type = asString(frame["type"]);
    if (type === "system" && asString(frame["subtype"]) === "init") {
      this.onInitFrame(frame);
      return;
    }
    if (type === "assistant") {
      this.onAssistantFrame(frame);
      return;
    }
    if (type === "user") {
      this.onToolResultFrame(frame);
      return;
    }
    if (type === "result") {
      this.onResultFrame(frame);
      return;
    }
    this.emitter.emit("runtime.log", "native", { frame });
  }

  private onInitFrame(frame: Record<string, unknown>): void {
    this.outcome.providerSessionId =
      asString(frame["session_id"]) ?? this.outcome.providerSessionId;
    this.model = asString(frame["model"]) ?? this.model;
    this.emitter.emit("runtime.provider_session", "native", {
      provider_session_id: this.outcome.providerSessionId,
      frame,
    });
  }

  private onAssistantFrame(frame: Record<string, unknown>): void {
    let emitted = false;
    for (const block of contentBlocks(frame)) {
      const blockType = asString(block["type"]);
      if (blockType === "text") {
        const text = asString(block["text"]);
        if (text !== null) {
          this.emitter.emit("runtime.message", "parsed", { role: "assistant", text });
          emitted = true;
        }
        continue;
      }
      if (blockType === "thinking") {
        const text = asString(block["thinking"]);
        if (text !== null) {
          this.emitter.emit("runtime.message", "parsed", {
            role: "assistant",
            text,
            thinking: true,
          });
          emitted = true;
        }
        continue;
      }
      if (blockType === "tool_use") {
        this.emitter.emit("runtime.tool_call", "parsed", {
          phase: "call",
          tool: asString(block["name"]) ?? "unknown",
          tool_use_id: asString(block["id"]),
          args: block["input"] ?? null,
        });
        emitted = true;
      }
    }
    if (!emitted) this.emitter.emit("runtime.log", "native", { frame });
  }

  private onToolResultFrame(frame: Record<string, unknown>): void {
    let emitted = false;
    for (const block of contentBlocks(frame)) {
      if (asString(block["type"]) !== "tool_result") continue;
      this.emitter.emit("runtime.tool_call", "parsed", {
        phase: "result",
        tool_use_id: asString(block["tool_use_id"]),
        is_error: block["is_error"] === true,
        result: block["content"] ?? null,
      });
      emitted = true;
    }
    if (!emitted) this.emitter.emit("runtime.log", "native", { frame });
  }

  private onResultFrame(frame: Record<string, unknown>): void {
    this.outcome.providerSessionId =
      asString(frame["session_id"]) ?? this.outcome.providerSessionId;
    const usage = asRecord(frame["usage"]);
    // Cache reads/creations are real prompt-side tokens; folded in so usage never understates the turn.
    const inputTokens =
      (asNumber(usage?.["input_tokens"]) ?? 0) +
      (asNumber(usage?.["cache_creation_input_tokens"]) ?? 0) +
      (asNumber(usage?.["cache_read_input_tokens"]) ?? 0);
    const outputTokens = asNumber(usage?.["output_tokens"]) ?? 0;
    this.outcome.usage = {
      model: this.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost_usd: asNumber(frame["total_cost_usd"]),
    };
    this.emitter.emit("runtime.usage", "native", { usage: this.outcome.usage, frame });

    const isError = frame["is_error"] === true || asString(frame["subtype"]) !== "success";
    this.outcome.result = {
      isError,
      message: isError
        ? (asString(frame["result"]) ?? asString(frame["subtype"]) ?? "provider reported an error")
        : null,
    };
  }
}

function contentBlocks(frame: Record<string, unknown>): Record<string, unknown>[] {
  const message = asRecord(frame["message"]);
  return asArray(message?.["content"])
    .map(asRecord)
    .filter((block): block is Record<string, unknown> => block !== null);
}
