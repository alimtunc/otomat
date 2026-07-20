import { collectTestEvidence } from "@web/lib/test-evidence";
import { describe, expect, it } from "vitest";

import { envelope } from "#support/envelope";

function commandEvent(command: string, index: number) {
  return envelope({
    id: `command-${index}`,
    type: "runtime.tool_call",
    seq: index,
    payload: {
      phase: "call",
      tool: "command_execution",
      tool_use_id: `tool-${index}`,
      args: { command },
    },
  });
}

describe("collectTestEvidence", () => {
  it.each([
    "pnpm test:e2e",
    "/bin/zsh -lc 'pnpm test:e2e'",
    "npx -y vitest",
    "npm exec -- vitest",
    "cargo test",
    "cargo test -v",
    "go test ./...",
    "go test -v ./...",
  ])("recognizes the explicit test command %s", (command) => {
    expect(collectTestEvidence([commandEvent(command, 0)])).toMatchObject([{ command }]);
  });

  it.each([
    "echo test",
    "echo vitest",
    "rg pytest",
    "npm install vitest",
    "vitest --version",
    "npx -y vitest --version",
    "vitest list",
    "cargo test --no-run",
    "go test -list .",
    "make test --help",
    "just test --help",
    "pnpm test -- --help",
    "pnpm lint",
    "pnpm check",
    "pnpm typecheck",
    "pnpm test || true",
    "pnpm test && pnpm lint",
    "true || vitest",
    "test -f marker && vitest",
    "pytest --collect-only",
    "echo 'not a test; vitest'",
    "sh -c \"echo 'not a test; vitest'\"",
  ])("does not invent test evidence for %s", (command) => {
    expect(collectTestEvidence([commandEvent(command, 0)])).toEqual([]);
  });

  it("requires a command tool even when another tool has a command-shaped argument", () => {
    const event = commandEvent("vitest", 0);
    event.payload["tool"] = "read_file";

    expect(collectTestEvidence([event])).toEqual([]);
  });
});
