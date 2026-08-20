import { describe, expect, it } from "vitest";

import { createPullRequestGenerator, sanitizeBranchName, type GenerationInput } from "#github";
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

describe("sanitizeBranchName", () => {
  it.each([
    ["Feat/Add Note!", "feat/add-note"],
    ["  fix: crash on boot  ", "fix-crash-on-boot"],
    ["feat//double--dash-", "feat/double-dash"],
  ])("slugs %j to %j", (raw, expected) => {
    expect(sanitizeBranchName(raw)).toBe(expected);
  });

  it("rejects run-branch collisions and empty results", () => {
    expect(sanitizeBranchName("otomat/run/abc")).toBeNull();
    expect(sanitizeBranchName("???")).toBeNull();
  });
});

describe("pull request generator", () => {
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

    await expect(createPullRequestGenerator(fake.run).generate(agent, INPUT)).rejects.toMatchObject(
      {
        code: "pr_generator_unavailable",
        message: "Codex sandbox unavailable on this host",
      },
    );
    expect(fake.requests).toEqual([]);
  });

  it("sends the configured model and effort, and answers one structured subject", async () => {
    const fake = runner([{ stdout: answer(PROPOSAL), stderr: "", exitCode: 0 }]);

    const proposal = await createPullRequestGenerator(fake.run).generate(AGENT, INPUT);

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

    await createPullRequestGenerator(fake.run).generate(AGENT, INPUT);

    const prompt = fake.requests[0]?.stdin ?? "";
    expect(prompt).toContain("Issue OTO-81: Simplify PR creation");
    expect(prompt).toContain("Make it one action.");
    expect(prompt).toContain("feat, fix, refactor, perf, test, docs, build, ci, chore, revert");
  });

  it("closes a partial delivery with Refs rather than Fixes", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, delivery: "partial" }), stderr: "", exitCode: 0 },
    ]);

    const proposal = await createPullRequestGenerator(fake.run).generate(AGENT, INPUT);

    expect(proposal.body).toContain("Refs OTO-81");
    expect(proposal.body).not.toContain("Fixes OTO-81");
  });

  it("refuses a type the repository does not publish", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, type: "wip" }), stderr: "", exitCode: 0 },
    ]);

    await expect(createPullRequestGenerator(fake.run).generate(AGENT, INPUT)).rejects.toMatchObject(
      { code: "pr_generation_invalid" },
    );
  });

  it("refuses a summary the composed subject cannot hold", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, summary: "x".repeat(80) }), stderr: "", exitCode: 0 },
    ]);

    await expect(createPullRequestGenerator(fake.run).generate(AGENT, INPUT)).rejects.toMatchObject(
      { code: "pr_generation_invalid", message: expect.stringContaining("72") },
    );
  });

  it("answers a scopeless subject when the change touches no single area", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, scope: null }), stderr: "", exitCode: 0 },
    ]);

    const proposal = await createPullRequestGenerator(fake.run).generate(AGENT, INPUT);

    expect(proposal.subject).toEqual({
      type: "feat",
      scope: null,
      summary: "create the pull request in one action",
    });
  });

  it("leaves an unidentified issue without a footer", async () => {
    const fake = runner([{ stdout: answer(PROPOSAL), stderr: "", exitCode: 0 }]);

    const proposal = await createPullRequestGenerator(fake.run).generate(AGENT, {
      ...INPUT,
      issue: { sourceIdentifier: null, title: "Local task", body: null },
    });

    expect(proposal.body).toBe("Publishes the run in one click.");
  });

  it("fails honestly when the CLI cannot run, carrying its last stderr line", async () => {
    const fake = runner([{ stdout: "", stderr: "not logged in", exitCode: 1 }]);

    await expect(createPullRequestGenerator(fake.run).generate(AGENT, INPUT)).rejects.toMatchObject(
      {
        code: "pr_generation_failed",
        message: expect.stringContaining("not logged in"),
      },
    );
  });

  it("bounds the invocation and names the deadline when it expires", async () => {
    const fake = runner([{ stdout: "", stderr: "", exitCode: null, errorCode: "timed_out" }]);

    await expect(createPullRequestGenerator(fake.run).generate(AGENT, INPUT)).rejects.toMatchObject(
      {
        code: "pr_generation_failed",
        message: expect.stringContaining("did not answer within"),
      },
    );
    expect(fake.requests[0]?.timeoutMs).toBeGreaterThan(0);
  });

  it("rejects output without a parsable JSON answer", async () => {
    const fake = runner([{ stdout: "I could not decide.", stderr: "", exitCode: 0 }]);

    await expect(createPullRequestGenerator(fake.run).generate(AGENT, INPUT)).rejects.toMatchObject(
      { code: "pr_generation_invalid" },
    );
  });

  it("rejects a branch name nothing usable survives", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, branch: "otomat/run/abc" }), stderr: "", exitCode: 0 },
    ]);

    await expect(createPullRequestGenerator(fake.run).generate(AGENT, INPUT)).rejects.toMatchObject(
      { code: "pr_generation_invalid" },
    );
  });
});
