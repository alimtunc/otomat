import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { RuntimeInteractionAnswer } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { LiveInputItem } from "#runtime/contract";
import { ClaudeRuntimeAdapter } from "#runtime/providers/claude/adapter";
import { MemorySink } from "#runtime/sinks";

import { runtimeRunInput } from "../support/runtime.js";
import {
  setupStubHarness,
  STUB_BIN,
  stdinFrames,
  stubFixture,
  teardownStubHarness,
  type RecordingChannel,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-claude-perm-");
  process.env["OTOMAT_STUB_PERMISSION"] = "1";
  process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-init-only.jsonl");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

interface TurnUnderTest {
  sink: MemorySink;
  channel: RecordingChannel;
}

/** Yields the answer only once the turn has emitted its question — the daemon's own order: it appends an answer for a request the ledger already carries. */
function turnAnswering(answer: RuntimeInteractionAnswer, requestId = "req-perm-1"): TurnUnderTest {
  const sink = new MemorySink();
  const receipts: Array<{ id: string; error: string | null }> = [];
  const asked = (): boolean =>
    sink.events.some((event) => event.type === "runtime.interaction_requested");
  return {
    sink,
    channel: {
      receipts,
      async *items(signal: AbortSignal): AsyncIterable<LiveInputItem> {
        while (!asked() && !signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        if (signal.aborted) return;
        yield { kind: "interaction_answer", id: "i1", request_id: requestId, answer };
        while (!signal.aborted) await new Promise((resolve) => setTimeout(resolve, 5));
      },
      wrote(id, error) {
        receipts.push({ id, error });
      },
    },
  };
}

function runTurn(turn: TurnUnderTest, signal = new AbortController().signal) {
  return new ClaudeRuntimeAdapter(STUB_BIN).run(
    runtimeRunInput({ run_dir: worktree, cwd: worktree, prompt: "do the work" }),
    turn.sink,
    signal,
    turn.channel,
  );
}

it("turns a can_use_tool control request into a runtime-agnostic question", async () => {
  const turn = turnAnswering({ kind: "permission", decision: "deny" });

  await runTurn(turn);

  const request = turn.sink.events.find((event) => event.type === "runtime.interaction_requested");
  expect(request?.payload).toMatchObject({
    request_id: "req-perm-1",
    kind: "permission",
    prompt: "Run Write: notes.md",
    tool: "Write",
    questions: [],
    reason: "the deny rule Read(./notes.md) covers it; only you can approve it.",
    tool_use_id: "tu-perm-1",
    permission_mode: "acceptEdits",
  });
});

it("sends an approval back as the tool input the operator was shown", async () => {
  const stdinFile = join(worktree, "stub-stdin.jsonl");
  process.env["OTOMAT_STUB_STDIN_FILE"] = stdinFile;
  const turn = turnAnswering({ kind: "permission", decision: "allow" });

  const final = await runTurn(turn);

  expect(final.status).toBe("completed");
  expect(stdinFrames(stdinFile).find((frame) => frame["type"] === "control_response")).toEqual({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: "req-perm-1",
      response: { behavior: "allow", updatedInput: { file_path: "notes.md", content: "ok" } },
    },
  });
  expect(turn.channel.receipts).toEqual([{ id: "i1", error: null }]);
});

it("sends a refusal as a deny the model reads, and never as an approval", async () => {
  const stdinFile = join(worktree, "stub-stdin.jsonl");
  process.env["OTOMAT_STUB_STDIN_FILE"] = stdinFile;

  await runTurn(turnAnswering({ kind: "permission", decision: "deny" }));

  const response = stdinFrames(stdinFile).find((frame) => frame["type"] === "control_response");
  expect(response).toMatchObject({
    response: { response: { behavior: "deny", message: expect.any(String) } },
  });
  expect(JSON.stringify(response)).not.toContain("allow");
});

it("reports a refusal once, not again as a provider-decided denial", async () => {
  const turn = turnAnswering({ kind: "permission", decision: "deny" });

  await runTurn(turn);

  const types = turn.sink.events.map((event) => event.type);
  expect(types.filter((type) => type === "runtime.interaction_requested")).toHaveLength(1);
  // The result frame echoes the same tool_use_id the operator already answered.
  expect(types).not.toContain("runtime.permission_request");
});

it("refuses an answer to a question this turn never asked instead of writing a blind approval", async () => {
  const stdinFile = join(worktree, "stub-stdin.jsonl");
  process.env["OTOMAT_STUB_STDIN_FILE"] = stdinFile;
  const turn = turnAnswering({ kind: "permission", decision: "allow" }, "req-from-elsewhere");

  const controller = new AbortController();
  const done = runTurn(turn, controller.signal);
  // The prompt frame must have landed in the capture before the abort, or the file may never exist.
  while (turn.channel.receipts.length === 0 || !existsSync(stdinFile)) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  controller.abort();
  await done;

  expect(turn.channel.receipts).toEqual([
    { id: "i1", error: "no open Claude request req-from-elsewhere on this turn" },
  ]);
  expect(stdinFrames(stdinFile).some((frame) => frame["type"] === "control_response")).toBe(false);
});

it("always sends the flag that routes an ask to Otomat rather than to an auto-denial", async () => {
  const argsFile = join(worktree, "stub-args.json");
  process.env["OTOMAT_STUB_ARGS_FILE"] = argsFile;

  await runTurn(turnAnswering({ kind: "permission", decision: "deny" }));

  const argv: string[] = JSON.parse(readFileSync(argsFile, "utf8"));
  expect(argv[argv.indexOf("--permission-prompt-tool") + 1]).toBe("stdio");
  // The frozen mode still travels with it: answering a question never widens what the provider decides alone.
  expect(argv).toContain("--permission-mode");
});

/** The shape the CLI sends for its question tool: an ask it needs answered, not an action it needs cleared. */
function asksQuestions(questions: unknown[]): void {
  process.env["OTOMAT_STUB_PERMISSION_REQUEST"] = JSON.stringify({
    subtype: "can_use_tool",
    tool_name: "AskUserQuestion",
    display_name: "AskUserQuestion",
    input: { questions },
    tool_use_id: "tu-ask-1",
    requires_user_interaction: true,
  });
}

const COLOUR_QUESTION = {
  question: "Which colour do you prefer?",
  header: "Colour",
  options: [
    { label: "Red", description: "You prefer red." },
    { label: "Blue", description: "You prefer blue." },
  ],
  multiSelect: false,
};

const SCOPE_QUESTION = {
  question: "How far should I go?",
  header: "Scope",
  options: [{ label: "Minimal" }, { label: "Thorough" }],
  multiSelect: true,
};

it("turns a native question into a choice carrying its own options, never an approval", async () => {
  asksQuestions([COLOUR_QUESTION]);
  const turn = turnAnswering({ kind: "choice", values: ["Red"] });

  await runTurn(turn);

  const request = turn.sink.events.find((event) => event.type === "runtime.interaction_requested");
  expect(request?.payload).toMatchObject({
    kind: "choice",
    prompt: "Which colour do you prefer?",
    tool: "AskUserQuestion",
    questions: [
      {
        prompt: "Which colour do you prefer?",
        select: "single",
        allows_custom: true,
        options: [
          { value: "Red", label: "Red", description: "You prefer red." },
          { value: "Blue", label: "Blue", description: "You prefer blue." },
        ],
      },
    ],
  });
});

it("sends the chosen option back as the answers the question tool reads", async () => {
  const stdinFile = join(worktree, "stub-stdin.jsonl");
  process.env["OTOMAT_STUB_STDIN_FILE"] = stdinFile;
  asksQuestions([COLOUR_QUESTION]);

  const final = await runTurn(turnAnswering({ kind: "choice", values: ["Red"] }));

  expect(final.status).toBe("completed");
  expect(
    stdinFrames(stdinFile).find((frame) => frame["type"] === "control_response"),
  ).toMatchObject({
    response: {
      response: {
        behavior: "allow",
        updatedInput: { answers: { "Which colour do you prefer?": "Red" } },
      },
    },
  });
});

it("carries a custom answer the runtime allows, and a multi-select as the comma-joined string it documents", async () => {
  const stdinFile = join(worktree, "stub-stdin.jsonl");
  process.env["OTOMAT_STUB_STDIN_FILE"] = stdinFile;
  asksQuestions([COLOUR_QUESTION, SCOPE_QUESTION]);

  const turn = turnAnswering({
    kind: "questionnaire",
    responses: [
      { question: "Which colour do you prefer?", values: ["Green, actually"] },
      { question: "How far should I go?", values: ["Minimal", "Thorough"] },
    ],
  });
  await runTurn(turn);

  const request = turn.sink.events.find((event) => event.type === "runtime.interaction_requested");
  // Several questions headline with the chips the tool gave them, not with one question's text.
  expect(request?.payload).toMatchObject({ kind: "questionnaire", prompt: "Colour · Scope" });
  expect(
    stdinFrames(stdinFile).find((frame) => frame["type"] === "control_response"),
  ).toMatchObject({
    response: {
      response: {
        updatedInput: {
          answers: {
            "Which colour do you prefer?": "Green, actually",
            "How far should I go?": "Minimal, Thorough",
          },
        },
      },
    },
  });
});

it("keeps the request open when an answer cannot be translated, rather than clearing the tool blindly", async () => {
  const stdinFile = join(worktree, "stub-stdin.jsonl");
  process.env["OTOMAT_STUB_STDIN_FILE"] = stdinFile;
  const turn = turnAnswering({ kind: "choice", values: ["Red"] });

  const controller = new AbortController();
  const done = runTurn(turn, controller.signal);
  while (turn.channel.receipts.length === 0 || !existsSync(stdinFile)) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  controller.abort();
  await done;

  expect(turn.channel.receipts).toEqual([
    { id: "i1", error: "Claude Code cannot take a choice answer for this request" },
  ]);
  expect(stdinFrames(stdinFile).some((frame) => frame["type"] === "control_response")).toBe(false);
});

it("falls back to the binary gate when the CLI sends a blank question, rather than dropping a request nothing can record", async () => {
  asksQuestions([{ ...COLOUR_QUESTION, options: [{ label: "" }, { label: "Blue" }] }]);
  const turn = turnAnswering({ kind: "permission", decision: "allow" });

  await runTurn(turn);

  const request = turn.sink.events.find((event) => event.type === "runtime.interaction_requested");
  expect(request?.payload).toMatchObject({
    kind: "permission",
    prompt: "Run AskUserQuestion?",
    questions: [],
  });
});
