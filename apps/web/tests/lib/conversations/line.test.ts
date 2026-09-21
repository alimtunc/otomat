import { conversationLine } from "@web/lib/conversations/line";
import { expect, it } from "vitest";

import { conversationEntry } from "#support/conversations";

it("orients by the question, then the waiting message, then the last thing said", () => {
  expect(conversationLine(conversationEntry())).toBe("Root cause found.");
  expect(
    conversationLine(
      conversationEntry({ last: { kind: "user", text: "Fix it.\nThen test.", at: "" } }),
    ),
  ).toBe("You: Fix it.");
  expect(conversationLine(conversationEntry({ queued_contributions: 2 }))).toBe(
    "2 messages queued · delivers on the next turn",
  );
  expect(
    conversationLine(
      conversationEntry({
        queued_contributions: 1,
        pending_interaction: { kind: "permission", prompt: "Run pnpm check?" },
      }),
    ),
  ).toBe("Permission: Run pnpm check?");
  expect(conversationLine(conversationEntry({ last: null }))).toBe("No message yet");
});
