import { describe, expect, it } from "vitest";

import { createPullRequestGenerator, sanitizeBranchName, type GenerationInput } from "#github";
import type { CommandRequest, CommandResult } from "#github";

const INPUT: GenerationInput = {
  cwd: "/worktree",
  issue: { identifier: "OTO-81", title: "Simplify PR creation", body: "Make it one action." },
  convention: "conventional",
  conventionEvidence: ["feat(pr): compact publication", "fix(board): prioritize completed issues"],
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
  subject: "feat(pr): create the pull request in one action",
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
  it("sends the configured model and effort, and composes the identifier into title, body and commit", async () => {
    const fake = runner([{ stdout: answer(PROPOSAL), stderr: "", exitCode: 0 }]);

    const proposal = await createPullRequestGenerator(fake.run).generate(AGENT, INPUT);

    expect(proposal).toEqual({
      title: "feat(pr): create the pull request in one action (OTO-81)",
      body: "Publishes the run in one click.\n\nFixes OTO-81",
      branch: "feat/compact-pr",
      commit: {
        subject: "feat(pr): create the pull request in one action",
        body: "The compact form composes generation and publication.",
      },
      generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
    });
    expect(fake.requests[0]).toMatchObject({
      command: "claude",
      args: AGENT.args,
      cwd: "/worktree",
    });
  });

  it("gives the generator the issue and the repository's own subjects rather than the patch alone", async () => {
    const fake = runner([{ stdout: answer(PROPOSAL), stderr: "", exitCode: 0 }]);

    await createPullRequestGenerator(fake.run).generate(AGENT, INPUT);

    const prompt = fake.requests[0]?.stdin ?? "";
    expect(prompt).toContain("Issue OTO-81: Simplify PR creation");
    expect(prompt).toContain("Make it one action.");
    expect(prompt).toContain("Conventional Commits");
    expect(prompt).toContain("fix(board): prioritize completed issues");
  });

  it("closes a partial delivery with Refs rather than Fixes", async () => {
    const fake = runner([
      { stdout: answer({ ...PROPOSAL, delivery: "partial" }), stderr: "", exitCode: 0 },
    ]);

    const proposal = await createPullRequestGenerator(fake.run).generate(AGENT, INPUT);

    expect(proposal.body).toContain("Refs OTO-81");
    expect(proposal.body).not.toContain("Fixes OTO-81");
  });

  it("refuses a subject the repository's convention would not accept", async () => {
    const fake = runner([
      {
        stdout: answer({ ...PROPOSAL, subject: "Create the pull request in one action" }),
        stderr: "",
        exitCode: 0,
      },
    ]);

    await expect(createPullRequestGenerator(fake.run).generate(AGENT, INPUT)).rejects.toMatchObject(
      { code: "pr_generation_invalid" },
    );
  });

  it("imposes no shape on a repository whose history shows none", async () => {
    const fake = runner([
      {
        stdout: answer({ ...PROPOSAL, subject: "Create the pull request in one action" }),
        stderr: "",
        exitCode: 0,
      },
    ]);

    const proposal = await createPullRequestGenerator(fake.run).generate(AGENT, {
      ...INPUT,
      convention: "free_form",
    });

    expect(proposal.commit.subject).toBe("Create the pull request in one action");
  });

  it("leaves an unidentified issue without a suffix or a footer", async () => {
    const fake = runner([{ stdout: answer(PROPOSAL), stderr: "", exitCode: 0 }]);

    const proposal = await createPullRequestGenerator(fake.run).generate(AGENT, {
      ...INPUT,
      issue: { identifier: null, title: "Local task", body: null },
    });

    expect(proposal.title).toBe("feat(pr): create the pull request in one action");
    expect(proposal.body).toBe("Publishes the run in one click.");
  });

  it("fails honestly when the CLI cannot run, carrying its last stderr line", async () => {
    const fake = runner([{ stdout: "", stderr: "not logged in", exitCode: 1 }]);

    await expect(createPullRequestGenerator(fake.run).generate(AGENT, INPUT)).rejects.toMatchObject(
      {
        code: "pr_generation_failed",
        message: expect.stringContaining("not logged in") as string,
      },
    );
  });

  it("bounds the invocation and names the deadline when it expires", async () => {
    const fake = runner([{ stdout: "", stderr: "", exitCode: null, errorCode: "timed_out" }]);

    await expect(createPullRequestGenerator(fake.run).generate(AGENT, INPUT)).rejects.toMatchObject(
      {
        code: "pr_generation_failed",
        message: expect.stringContaining("did not answer within") as string,
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
