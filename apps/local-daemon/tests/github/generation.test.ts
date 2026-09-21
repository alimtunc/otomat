import { COMMIT_SUBJECT_MAX_LENGTH, formatCommitSubject } from "@otomat/domain";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPullRequestGenerator,
  GenerationTrace,
  GitHubPublicationError,
  type GenerationInput,
} from "#github";
import type { CommandRequest, CommandResult } from "#github";
import { RuntimeUnavailableError } from "#runtime";

const INPUT: GenerationInput = {
  cwd: "/worktree",
  issue: {
    sourceIdentifier: "OTO-81",
    title: "Simplify PR creation",
    body: "Make it one action.",
  },
  diffStat: ["note.md +1 -0"],
  patch: "diff --git a/note.md b/note.md\n+je teste le vps\n",
};

const AGENT = {
  command: "claude",
  args: ["-p", "--output-format", "text", "--effort", "high", "--model", "claude-opus-5"],
  effort: "high",
  audit: { runtime: "claude", model: "claude-opus-5", effort: "high" },
};

function answer(payload: Record<string, unknown>): string {
  return `Sure!\n<otomat-json>${JSON.stringify(payload)}</otomat-json>\n`;
}

const PROPOSAL = {
  type: "feat",
  scope: "pr",
  summary: "create the pull request in one action",
  body: "Publishes the run in one click.",
  commit_body: "The compact form composes generation and publication.",
  branch: "Feat/Compact PR",
  delivery: "complete",
};

function generate(
  run: (request: CommandRequest) => Promise<CommandResult>,
  agent = AGENT,
  input = INPUT,
  trace = new GenerationTrace("run test"),
) {
  return createPullRequestGenerator(run).generate(agent, input, trace);
}

function runner(results: CommandResult[]) {
  const requests: CommandRequest[] = [];
  return {
    requests,
    run: async (request: CommandRequest): Promise<CommandResult> => {
      requests.push(request);
      const result = results.shift();
      if (!result) throw new Error("unexpected command");
      return result;
    },
  };
}

describe("pull request generator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("traces each step's duration and the provider's exit, never the prompt or the answer", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const fake = runner([{ stdout: answer(PROPOSAL), stderr: "", exitCode: 0 }]);
    const trace = new GenerationTrace("run r-1");

    await generate(fake.run, AGENT, INPUT, trace);
    trace.finish();

    expect(log).toHaveBeenCalledOnce();
    const line = String(log.mock.calls[0]?.[0]);
    expect(line).toMatch(
      /^\[otomat\] pr generation for run r-1: preflight \d+ms · provider \d+ms \(claude claude-opus-5 high, prompt \d+ kchar, exit 0, stdout \d+ kchar\) · validate \d+ms · ok$/,
    );
    expect(line).not.toContain("je teste le vps");
    expect(line).not.toContain(PROPOSAL.summary);
  });

  it("traces the provider's exit code and the refusal that ends a failed attempt", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const fake = runner([{ stdout: "", stderr: "", exitCode: null, errorCode: "timed_out" }]);
    const trace = new GenerationTrace("run r-2");

    await expect(generate(fake.run, AGENT, INPUT, trace)).rejects.toMatchObject({
      code: "pr_generation_failed",
    });
    trace.finish(new GitHubPublicationError("pr_generation_failed", "slow"));

    expect(String(log.mock.calls[0]?.[0])).toMatch(
      /provider \d+ms \(claude claude-opus-5 high, prompt \d+ kchar, exit timed_out, stdout 0 kchar\) · failed pr_generation_failed$/,
    );
  });

  it("maps a sandbox preflight refusal before invoking the generator command", async () => {
    const fake = runner([]);
    const agent = {
      ...AGENT,
      preflight: () => {
        throw new RuntimeUnavailableError(
          "codex",
          "sandbox_unavailable",
          "Codex sandbox unavailable on this host",
        );
      },
    };

    await expect(generate(fake.run, agent)).rejects.toMatchObject({
      code: "pr_generator_unavailable",
      message: "Codex sandbox unavailable on this host",
    });
    expect(fake.requests).toEqual([]);
  });

  it("sends the configured model and effort, and answers one structured subject", async () => {
    const fake = runner([{ stdout: answer(PROPOSAL), stderr: "", exitCode: 0 }]);

    const proposal = await generate(fake.run);

    expect(proposal).toEqual({
      subject: { type: "feat", scope: "pr", summary: "create the pull request in one action" },
      body: "Publishes the run in one click.\n\nFixes OTO-81",
      branch: "feat/compact-pr",
      commit_body: "The compact form composes generation and publication.",
      generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
    });
    expect(fake.requests[0]).toMatchObject({
      command: "claude",
      args: AGENT.args,
      cwd: "/worktree",
    });
  });

  it("gives the generator the issue and the allowed types rather than the patch alone", async () => {
    const fake = runner([{ stdout: answer(PROPOSAL), stderr: "", exitCode: 0 }]);

    await generate(fake.run);

    const prompt = fake.requests[0]?.stdin ?? "";
    expect(prompt).toContain("Issue OTO-81: Simplify PR creation");
    expect(prompt).toContain("Make it one action.");
    expect(prompt).toContain("feat, fix, refactor, perf, test, docs, build, ci, chore, revert");
  });

  it("closes a partial delivery with Refs rather than Fixes", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, delivery: "partial" }), stderr: "", exitCode: 0 },
    ]);

    const proposal = await generate(fake.run);

    expect(proposal.body).toContain("Refs OTO-81");
    expect(proposal.body).not.toContain("Fixes OTO-81");
  });

  it("refuses a type the repository does not publish", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, type: "wip" }), stderr: "", exitCode: 0 },
    ]);

    await expect(generate(fake.run)).rejects.toMatchObject({ code: "pr_generation_invalid" });
  });

  it("shortens an over-budget summary on whole words rather than failing the publication", async () => {
    const summary =
      "create the pull request in one action and keep every field editable afterwards";
    const fake = runner([{ stdout: answer({ ...PROPOSAL, summary }), stderr: "", exitCode: 0 }]);

    const proposal = await generate(fake.run);

    expect(formatCommitSubject(proposal.subject).length).toBeLessThanOrEqual(
      COMMIT_SUBJECT_MAX_LENGTH,
    );
    expect(proposal.subject.summary).toBe(
      "create the pull request in one action and keep every field",
    );
    expect(fake.requests).toHaveLength(1);
  });

  it("asks once more with the exact budget when no whole word survives", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, summary: "x".repeat(80) }), stderr: "", exitCode: 0 },
      { stdout: answer(PROPOSAL), stderr: "", exitCode: 0 },
    ]);

    const proposal = await generate(fake.run);

    expect(proposal.subject.summary).toBe("create the pull request in one action");
    expect(fake.requests).toHaveLength(2);
    expect(fake.requests[1]?.stdin).toContain("the summary must be at most 62 characters");
    expect(fake.requests[1]?.stdin).toContain("remove 18 to stay within 72");
  });

  it("refuses with the contract's own message when the second answer is still too long", async () => {
    const tooLong = { ...PROPOSAL, summary: "x".repeat(80) };
    const fake = runner([
      { stdout: answer(tooLong), stderr: "", exitCode: 0 },
      { stdout: answer(tooLong), stderr: "", exitCode: 0 },
    ]);

    await expect(generate(fake.run)).rejects.toMatchObject({
      code: "pr_generation_invalid",
      message: "The subject is 90 characters; remove 18 to stay within 72.",
    });
    expect(fake.requests).toHaveLength(2);
  });

  it("asks again with the scope the contract refused, and takes the corrected answer", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, scope: "PR Publication" }), stderr: "", exitCode: 0 },
      { stdout: answer(PROPOSAL), stderr: "", exitCode: 0 },
    ]);

    const proposal = await generate(fake.run);

    expect(proposal.subject.scope).toBe("pr");
    expect(fake.requests).toHaveLength(2);
    expect(fake.requests[1]?.stdin).toContain(
      "A scope is lowercase, without spaces or parentheses.",
    );
  });

  it("refuses a scope that leaves the summary no budget at all", async () => {
    const scoped = {
      ...PROPOSAL,
      scope: `publication/generation/${"commit-subject-budget/".repeat(3)}resolver`,
    };
    const fake = runner([
      { stdout: answer(scoped), stderr: "", exitCode: 0 },
      { stdout: answer(scoped), stderr: "", exitCode: 0 },
    ]);

    await expect(generate(fake.run)).rejects.toMatchObject({
      code: "pr_generation_invalid",
      message: expect.stringContaining("stay within 72"),
    });
    expect(fake.requests[1]?.stdin).toContain("the summary must be at most 0 characters");
  });

  it("answers a scopeless subject when the change touches no single area", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, scope: null }), stderr: "", exitCode: 0 },
    ]);

    const proposal = await generate(fake.run);

    expect(proposal.subject).toEqual({
      type: "feat",
      scope: null,
      summary: "create the pull request in one action",
    });
  });

  it("leaves an unidentified issue without a footer", async () => {
    const fake = runner([{ stdout: answer(PROPOSAL), stderr: "", exitCode: 0 }]);

    const proposal = await generate(fake.run, AGENT, {
      ...INPUT,
      issue: { sourceIdentifier: null, title: "Local task", body: null },
    });

    expect(proposal.body).toBe("Publishes the run in one click.");
  });

  it("fails honestly when the CLI cannot run, carrying its last stderr line", async () => {
    const fake = runner([{ stdout: "", stderr: "not logged in", exitCode: 1 }]);

    await expect(generate(fake.run)).rejects.toMatchObject({
      code: "pr_generation_failed",
      message: expect.stringContaining("not logged in"),
    });
  });

  it("bounds the invocation and names the deadline when it expires", async () => {
    const fake = runner([{ stdout: "", stderr: "", exitCode: null, errorCode: "timed_out" }]);

    await expect(generate(fake.run)).rejects.toMatchObject({
      code: "pr_generation_failed",
      message: expect.stringContaining("did not answer within"),
    });
    expect(fake.requests[0]?.timeoutMs).toBeGreaterThan(0);
  });

  it("rejects output without a parsable JSON answer", async () => {
    const fake = runner([{ stdout: "I could not decide.", stderr: "", exitCode: 0 }]);

    await expect(generate(fake.run)).rejects.toMatchObject({ code: "pr_generation_invalid" });
  });

  it("rejects a branch name nothing usable survives", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, branch: "otomat/run/abc" }), stderr: "", exitCode: 0 },
    ]);

    await expect(generate(fake.run)).rejects.toMatchObject({ code: "pr_generation_invalid" });
  });
});
