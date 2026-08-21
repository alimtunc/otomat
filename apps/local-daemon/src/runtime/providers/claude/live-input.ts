import type { LiveInputChannel } from "#runtime/contract";
import { errorMessage } from "#runtime/errors";

/** Claude Code's streaming-input frame: one user message per line on stdin. */
export function claudeUserFrame(body: string): string {
  return `${JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text: body }] },
  })}\n`;
}

/**
 * Keeps one Claude turn's stdin open for the messages the daemon hands it while
 * it works. stdin closes on the first `result` frame that follows no unanswered
 * write, so every message written reaches the provider before EOF and no turn
 * waits on an answer nobody owes it.
 */
export class ClaudeLiveInput {
  private readonly done = new AbortController();
  private writtenSinceResult = 0;

  constructor(private readonly channel: LiveInputChannel) {}

  readonly onResult = (): void => {
    if (this.writtenSinceResult === 0) this.done.abort();
    else this.writtenSinceResult = 0;
  };

  readonly stream = async (
    write: (chunk: string) => Promise<void>,
    signal: AbortSignal,
  ): Promise<void> => {
    for await (const message of this.channel.messages(
      AbortSignal.any([signal, this.done.signal]),
    )) {
      try {
        await write(claudeUserFrame(message.body));
      } catch (error) {
        // The receipt carries the refusal: the daemon returns the message to its queue for the next turn.
        this.channel.wrote(message.id, errorMessage(error));
        return;
      }
      this.writtenSinceResult += 1;
      this.channel.wrote(message.id, null);
    }
  };
}
