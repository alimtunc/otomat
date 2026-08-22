import { afterEach, beforeEach, expect, it } from "vitest";

import { claudeResumeModelCapability } from "#runtime/providers/claude/resume-model";
import { codexResumeModelCapability } from "#runtime/providers/codex/resume-model";

import {
  setupStubHarness,
  STUB_BIN,
  stubFixture,
  teardownStubHarness,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-resume-model-");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

it("allows Claude model selection only when the installed help announces both flags", () => {
  process.env.OTOMAT_STUB_FIXTURE = stubFixture("claude-help-current.txt");

  expect(claudeResumeModelCapability(STUB_BIN)).toEqual({ status: "supported" });

  teardownStubHarness(worktree);
  worktree = setupStubHarness("otomat-resume-model-empty-");
  process.env.OTOMAT_STUB_FIXTURE = stubFixture("claude-init-only.jsonl");
  expect(claudeResumeModelCapability(STUB_BIN)).toMatchObject({
    status: "unsupported",
    reason: expect.stringMatching(/native resume/i),
  });
});

it("allows Codex model selection only when exec and native resume are both announced", () => {
  process.env.OTOMAT_STUB_FIXTURES = JSON.stringify({
    "exec --help": stubFixture("codex-exec-help.txt"),
    "exec resume --help": stubFixture("codex-exec-resume-help.txt"),
  });

  expect(codexResumeModelCapability(STUB_BIN)).toEqual({ status: "supported" });

  teardownStubHarness(worktree);
  worktree = setupStubHarness("otomat-resume-model-missing-");
  process.env.OTOMAT_STUB_FIXTURES = JSON.stringify({
    "exec --help": stubFixture("codex-exec-help.txt"),
    "exec resume --help": stubFixture("codex-frames.jsonl"),
  });
  expect(codexResumeModelCapability(STUB_BIN)).toMatchObject({
    status: "unsupported",
    reason: expect.stringMatching(/native exec resume/i),
  });
});
