import type { PermissionModeStatus } from "@otomat/domain";

import { asArray, asNumber, asRecord, asString } from "#runtime/cli/frame-guards";
import type { ProviderFrameMapper, ProviderTurnOutcome } from "#runtime/cli/turn";
import type { TurnEmitter } from "#runtime/cli/turn-emitter";

import { claudeProviderLimit } from "./limits.js";

/** What the turn was launched under, resolved against the installed binary before the first frame arrives. */
interface ClaudeTurnPermission {
  mode: string;
  status: PermissionModeStatus;
}

export class ClaudeFrameMapper implements ProviderFrameMapper {
  readonly outcome: ProviderTurnOutcome = {
    providerSessionId: null,
    usage: null,
    result: null,
    limit: null,
  };

  private model: string | null = null;

  constructor(
    private readonly emitter: TurnEmitter,
    private readonly permission: ClaudeTurnPermission,
    /** Told when the provider closed an agent loop, so a live turn knows whether it still owes an answer. */
    private readonly onResult?: () => void,
  ) {}

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

  /** A refused call leaves the turn reported as a success, so without this the run would look fully autonomous. */
  private onPermissionDenials(frame: Record<string, unknown>): void {
    for (const denial of asArray(frame["permission_denials"]).map(asRecord)) {
      if (denial === null) continue;
      const toolUseId = asString(denial["tool_use_id"]);
      this.emitter.emit("runtime.permission_request", "parsed", {
        tool: asString(denial["tool_name"]),
        tool_use_id: toolUseId,
        input: denial["tool_input"] ?? null,
        permission_mode: this.permission.mode,
        permission_mode_status: this.permission.status,
      });
      this.emitter.emit("runtime.permission_response", "parsed", {
        tool_use_id: toolUseId,
        decision: "denied",
        decided_by: "provider",
      });
    }
  }

  /** A result frame's `usage` covers only its own agent loop, so a steered turn sums them; `total_cost_usd` is already the invocation's running total, so the latest frame wins. */
  private onResultUsage(frame: Record<string, unknown>): void {
    const usage = asRecord(frame["usage"]);
    // Cache reads/creations are real prompt-side tokens; folded in so usage never understates the turn.
    const inputTokens =
      (asNumber(usage?.["input_tokens"]) ?? 0) +
      (asNumber(usage?.["cache_creation_input_tokens"]) ?? 0) +
      (asNumber(usage?.["cache_read_input_tokens"]) ?? 0);
    const outputTokens = asNumber(usage?.["output_tokens"]) ?? 0;
    const cost = asNumber(frame["total_cost_usd"]);
    const previous = this.outcome.usage;
    this.outcome.usage = {
      model: this.model,
      input_tokens: (previous?.input_tokens ?? 0) + inputTokens,
      output_tokens: (previous?.output_tokens ?? 0) + outputTokens,
      total_tokens: (previous?.total_tokens ?? 0) + inputTokens + outputTokens,
      cost_usd: cost ?? previous?.cost_usd ?? null,
    };
    this.emitter.emit("runtime.usage", "native", { usage: this.outcome.usage, frame });
  }

  private onResultFrame(frame: Record<string, unknown>): void {
    this.onPermissionDenials(frame);
    this.outcome.providerSessionId =
      asString(frame["session_id"]) ?? this.outcome.providerSessionId;
    this.onResultUsage(frame);

    const isError = frame["is_error"] === true || asString(frame["subtype"]) !== "success";
    this.outcome.result = {
      isError,
      message: isError
        ? (asString(frame["result"]) ?? asString(frame["subtype"]) ?? "provider reported an error")
        : null,
    };
    if (isError) this.onProviderLimit(frame);
    this.onResult?.();
  }

  private onProviderLimit(frame: Record<string, unknown>): void {
    const limit = claudeProviderLimit(frame);
    if (limit === null) return;
    this.outcome.limit = limit;
    this.emitter.emit("runtime.provider_limit", "native", { ...limit, frame });
  }
}

function contentBlocks(frame: Record<string, unknown>): Record<string, unknown>[] {
  const message = asRecord(frame["message"]);
  return asArray(message?.["content"])
    .map(asRecord)
    .filter((block): block is Record<string, unknown> => block !== null);
}
