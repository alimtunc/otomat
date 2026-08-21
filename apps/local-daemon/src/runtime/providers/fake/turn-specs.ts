import type { RuntimeUsage } from "#runtime/contract";
import type { EventFidelity, RuntimeEvent } from "#runtime/events";

export const FAKE_USAGE: RuntimeUsage = {
  model: "fake-model-v1",
  input_tokens: 128,
  output_tokens: 64,
  total_tokens: 192,
  cost_usd: 0,
};

export interface EventSpec {
  type: RuntimeEvent["type"];
  fidelity: EventFidelity;
  data: Record<string, unknown>;
}

function log(text: string, stream: "stdout" | "stderr" = "stdout"): EventSpec {
  return { type: "runtime.log", fidelity: "raw_log", data: { stream, text } };
}

/** The assistant text a conversation surface shows on its own; `thinking` is reasoning, not the answer. */
function message(text: string, thinking = false): EventSpec {
  const data: EventSpec["data"] = { role: "assistant", text };
  if (thinking) data["thinking"] = true;
  return { type: "runtime.message", fidelity: "parsed", data };
}

function toolCall(
  tool: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>,
): EventSpec {
  return { type: "runtime.tool_call", fidelity: "parsed", data: { tool, args, result } };
}

export function runSpecs(prompt: string, providerSession: string): EventSpec[] {
  return [
    {
      type: "runtime.provider_session",
      fidelity: "native",
      data: {
        provider_session_id: providerSession,
        frame: { kind: "session.created", session: providerSession, model: FAKE_USAGE.model },
      },
    },
    log("[simulation] session started"),
    log(`[simulation] received prompt: ${prompt}`),
    message("Let me read the repository before I change anything.", true),
    toolCall("read_file", { path: "README.md" }, { ok: true, bytes: 42 }),
    {
      type: "runtime.permission_request",
      fidelity: "parsed",
      data: { request_id: "perm-1", action: "write_file", path: "src/index.ts" },
    },
    {
      type: "runtime.permission_response",
      fidelity: "parsed",
      data: { request_id: "perm-1", decision: "approved", auto: true },
    },
    log("[simulation] writing the placeholder change"),
    toolCall("write_file", { path: "src/index.ts" }, { ok: true, bytes: 17 }),
    { type: "runtime.usage", fidelity: "parsed", data: { usage: FAKE_USAGE } },
    message(
      `No model was contacted, so "${prompt}" is not implemented: the diff holds a placeholder change instead.`,
    ),
    log("[simulation] done"),
  ];
}

export function resumeSpecs(prompt: string, providerSession: string): EventSpec[] {
  return [
    log(`[simulation] resumed session ${providerSession}`),
    log(`[simulation] follow-up: ${prompt}`),
    toolCall("edit_file", { path: "src/index.ts" }, { ok: true, bytes: 9 }),
    { type: "runtime.usage", fidelity: "parsed", data: { usage: FAKE_USAGE } },
    message("The follow-up was recorded on the same branch, again without contacting a model."),
    log("[simulation] done"),
  ];
}

export function abortSpec(): EventSpec {
  return log("[simulation] aborted", "stderr");
}
