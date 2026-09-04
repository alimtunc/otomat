import type { RuntimeInteractionAnswer } from "@otomat/domain";

import type { LiveInputChannel, LiveInputItem } from "#runtime/contract";
import { errorMessage } from "#runtime/errors";

import { claudeAnsweredInput } from "./questions.js";

/** Claude Code's streaming-input frame: one user message per line on stdin. */
export function claudeUserFrame(body: string): string {
  return `${JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text: body }] },
  })}\n`;
}

/**
 * Answers one `can_use_tool` control request. An approval re-sends the tool input
 * the CLI asked about, unchanged for a permission gate and carrying the operator's
 * answers for a question: Otomat clears the call that was shown to the operator,
 * never a rewritten one.
 */
function claudeControlResponse(
  requestId: string,
  answer: RuntimeInteractionAnswer,
  toolInput: unknown,
): string | { error: string } {
  const decision = claudeDecision(answer, toolInput);
  if (decision === null) {
    return { error: `Claude Code cannot take a ${answer.kind} answer for this request` };
  }
  return `${JSON.stringify({
    type: "control_response",
    response: { subtype: "success", request_id: requestId, response: decision },
  })}\n`;
}

type ClaudeDecision =
  | { behavior: "allow"; updatedInput: unknown }
  | { behavior: "deny"; message: string };

function claudeDecision(
  answer: RuntimeInteractionAnswer,
  toolInput: unknown,
): ClaudeDecision | null {
  if (answer.kind === "permission") {
    return answer.decision === "allow"
      ? { behavior: "allow", updatedInput: toolInput }
      : { behavior: "deny", message: "The operator refused this action in Otomat." };
  }
  // A question is cleared by allowing its tool with the answers filled in; there is no deny that carries them.
  const answered = claudeAnsweredInput(toolInput, answer);
  return answered === null ? null : { behavior: "allow", updatedInput: answered };
}

/**
 * Keeps one Claude turn's stdin open for the items the daemon hands it while it
 * works. stdin closes on the first `result` frame that follows no unanswered user
 * message, so every message written reaches the provider before EOF and no turn
 * waits on an answer nobody owes it. A control response is not a user message: it
 * unblocks the loop already running, so it never postpones that close.
 */
export class ClaudeLiveInput {
  private readonly done = new AbortController();
  private writtenSinceResult = 0;
  private readonly pendingInput = new Map<string, unknown>();

  constructor(private readonly channel: LiveInputChannel) {}

  /** Told by the frame mapper what the CLI asked about, so an approval can echo that exact input back. */
  readonly onRequest = (requestId: string, toolInput: unknown): void => {
    this.pendingInput.set(requestId, toolInput);
  };

  readonly onResult = (): void => {
    if (this.writtenSinceResult === 0) this.done.abort();
    else this.writtenSinceResult = 0;
  };

  readonly stream = async (
    write: (chunk: string) => Promise<void>,
    signal: AbortSignal,
  ): Promise<void> => {
    for await (const item of this.channel.items(AbortSignal.any([signal, this.done.signal]))) {
      const frame = this.frameFor(item);
      if (typeof frame !== "string") {
        this.channel.wrote(item.id, frame.error);
        continue;
      }
      try {
        await write(frame);
      } catch (error) {
        // The receipt carries the refusal: the daemon returns the item to its queue for the next turn.
        this.channel.wrote(item.id, errorMessage(error));
        return;
      }
      if (item.kind === "message") this.writtenSinceResult += 1;
      this.channel.wrote(item.id, null);
    }
  };

  private frameFor(item: LiveInputItem): string | { error: string } {
    if (item.kind === "message") return claudeUserFrame(item.body);
    if (!this.pendingInput.has(item.request_id)) {
      return { error: `no open Claude request ${item.request_id} on this turn` };
    }
    const frame = claudeControlResponse(
      item.request_id,
      item.answer,
      this.pendingInput.get(item.request_id),
    );
    // The request stays open when no frame was produced: nothing was handed over, so the answer can still be retried.
    if (typeof frame === "string") this.pendingInput.delete(item.request_id);
    return frame;
  }
}
