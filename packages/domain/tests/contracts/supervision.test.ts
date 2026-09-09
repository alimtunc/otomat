import { parseSupervisionDecision, supervisionRequestSchema } from "@otomat/domain";
import { describe, expect, it } from "vitest";

function block(body: string): string {
  return `Here is my read.\n\n\`\`\`json\n${body}\n\`\`\`\n`;
}

describe("parseSupervisionDecision", () => {
  it("reads a well-formed decision out of the supervisor's own text", () => {
    const decision = parseSupervisionDecision(block('{"decision":"pass","reason":"it landed"}'));
    expect(decision).toEqual({ decision: "pass", reason: "it landed" });
  });

  it("takes the last block, so a quoted example never decides", () => {
    const text = `${block('{"decision":"pass","reason":"example"}')}${block(
      '{"decision":"blocked","reason":"the base moved"}',
    )}`;
    expect(parseSupervisionDecision(text)?.decision).toBe("blocked");
  });

  it("reads nothing from approving prose", () => {
    expect(parseSupervisionDecision("Looks great, ship it.")).toBeNull();
  });

  it("rejects needs_changes without the instructions its remediation turn would carry", () => {
    expect(
      parseSupervisionDecision(block('{"decision":"needs_changes","reason":"thin"}')),
    ).toBeNull();
  });

  it("rejects a block that is not JSON, and an unknown decision", () => {
    expect(parseSupervisionDecision(block("{not json"))).toBeNull();
    expect(parseSupervisionDecision(block('{"decision":"maybe","reason":"x"}'))).toBeNull();
  });
});

describe("supervisionRequestSchema", () => {
  it("requires exactly one supervisor agent", () => {
    expect(supervisionRequestSchema.safeParse({ runtime: "claude" }).success).toBe(true);
    expect(supervisionRequestSchema.safeParse({}).success).toBe(false);
    expect(
      supervisionRequestSchema.safeParse({ runtime: "claude", profile_id: "p1" }).success,
    ).toBe(false);
  });

  it("defaults the loop limit and leaves the budget uncapped", () => {
    const parsed = supervisionRequestSchema.parse({ runtime: "claude" });
    expect(parsed.max_loops).toBe(3);
    expect(parsed.budget_usd).toBeNull();
  });
});
