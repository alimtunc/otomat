import { expect, it, vi } from "vitest";

import { GitHubPublicationError } from "#github";
import { makeApiApp, post, request } from "#test-support/api";
import { setupTestDb } from "#test-support/db";
import { PUBLISHABLE_WORKSPACE, pullRequestRow, stubGitHubService } from "#test-support/github";

it("routes project preview, generation and publication through the shared structured contract", async () => {
  const fix = setupTestDb("otomat-project-publication-");
  const preview = vi.fn(async () => ({
    revision: "revision",
    publishability: PUBLISHABLE_WORKSPACE,
  }));
  const generate = vi.fn(async () => {
    throw new GitHubPublicationError(
      "pr_generator_not_configured",
      "Choose a PR generator in Settings.",
    );
  });
  const publish = vi.fn(async () =>
    pullRequestRow({ run_id: null, issue_id: null, repository_id: "repo-1" }),
  );
  const app = makeApiApp(fix, {
    github: stubGitHubService({
      previewRepositoryPullRequest: preview,
      generateRepositoryPullRequest: generate,
      publishRepositoryPullRequest: publish,
    }),
  });
  try {
    const read = await request(app, "/api/repositories/repo-1/pr?base_ref=feature%2Fbase");
    expect(read.status).toBe(200);
    expect(preview).toHaveBeenCalledExactlyOnceWith("repo-1", "feature/base");
    expect(publish).not.toHaveBeenCalled();
    const failed = await post(app, "/api/repositories/repo-1/pr/generate", {
      revision: "revision",
      base_ref: "main",
    });
    expect(failed.status).toBe(409);
    expect(await failed.json()).toMatchObject({ error: "pr_generator_not_configured" });
    const input = { revision: "revision", base_ref: "main", mode: "ready" };
    expect(
      (
        await post(app, "/api/repositories/repo-1/pr", {
          ...input,
          title: "old flat title",
          body: "old body",
        })
      ).status,
    ).toBe(400);
    expect(publish).not.toHaveBeenCalled();
    expect((await post(app, "/api/repositories/repo-1/pr", input)).status).toBe(200);
    expect(publish).toHaveBeenCalledExactlyOnceWith("repo-1", input);
    expect(generate).toHaveBeenCalledExactlyOnceWith("repo-1", {
      revision: "revision",
      base_ref: "main",
    });
  } finally {
    fix.cleanup();
  }
});
