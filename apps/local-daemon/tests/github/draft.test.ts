import { describe, expect, it } from "vitest";

import { createPullRequestDrafter, sanitizeBranchName, type PullRequestDraftInput } from "#github";
import type { CommandRequest, CommandResult } from "#github";

const INPUT: PullRequestDraftInput = {
  runtime: "claude",
  cwd: "/worktree",
  objective: "Add a note file",
  diffStat: ["note.md +1 -0"],
  patch: "diff --git a/note.md b/note.md\n+je teste le vps\n",
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

describe("pull request drafter", () => {
  it("prompts the run's agent in print mode and parses the JSON draft", async () => {
    const fake = runner([
      {
        stdout:
          'Sure!\n{"title": "Add note.md", "body": "Adds the note.", "branch": "Feat/Add Note"}\n',
        stderr: "",
        exitCode: 0,
      },
    ]);
    const drafter = createPullRequestDrafter(fake.run);

    const draft = await drafter.draft(INPUT);

    expect(draft).toEqual({
      title: "Add note.md",
      body: "Adds the note.",
      branch: "feat/add-note",
    });
    expect(fake.requests[0]).toMatchObject({
      command: "claude",
      args: ["-p", "--output-format", "text"],
      cwd: "/worktree",
    });
    expect(fake.requests[0]?.stdin).toContain("Add a note file");
    expect(fake.requests[0]?.stdin).toContain("note.md +1 -0");
  });

  it("fails honestly when the agent cannot run, carrying its last stderr line", async () => {
    const fake = runner([{ stdout: "", stderr: "not logged in", exitCode: 1 }]);

    await expect(createPullRequestDrafter(fake.run).draft(INPUT)).rejects.toMatchObject({
      code: "pr_draft_failed",
      message: expect.stringContaining("not logged in") as string,
    });
  });

  it("rejects output without a parsable JSON draft", async () => {
    const fake = runner([{ stdout: "I could not decide.", stderr: "", exitCode: 0 }]);

    await expect(createPullRequestDrafter(fake.run).draft(INPUT)).rejects.toMatchObject({
      code: "pr_draft_invalid",
    });
  });

  it("refuses a runtime without a draft mode before spawning anything", async () => {
    const fake = runner([]);

    await expect(
      createPullRequestDrafter(fake.run).draft({ ...INPUT, runtime: "codex" }),
    ).rejects.toMatchObject({ code: "pr_draft_unsupported_runtime" });
    expect(fake.requests).toHaveLength(0);
  });
});
