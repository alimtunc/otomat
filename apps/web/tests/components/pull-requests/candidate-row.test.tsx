// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { PullRequestCandidate } from "@otomat/domain";
import { PullRequestCandidateRow } from "@web/components/pull-requests/candidate-row";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mountWithQuery, type Mounted } from "#support/mount";

const attachPullRequest = vi.fn(async (_issueId: string, _request: unknown) => ({
  id: "pr-1",
  number: 18,
}));

vi.mock("@web/api/client", () => ({
  daemon: {
    attachPullRequest: (issueId: string, request: unknown) => attachPullRequest(issueId, request),
  },
}));

const mounted: Mounted[] = [];

afterEach(async () => {
  for (const rendered of mounted.splice(0)) await rendered.cleanup();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

function candidate(overrides: Partial<PullRequestCandidate> = {}): PullRequestCandidate {
  return {
    evidence: {
      repository: "acme/otomat",
      number: 18,
      base_ref: "main",
      head_ref: "contrib/anti-slop",
      head_sha: "a".repeat(40),
      author_login: "contrib",
      status: "open",
      discovery: "issue_reference",
      verified_at: "2026-08-19T10:00:00.000Z",
    },
    reference: { identifier: "OTO-119", surface: "body", excerpt: "Refs OTO-119" },
    provenance: "external",
    reason: "@contrib opened it on contrib/anti-slop, a branch Otomat does not own.",
    workspace_owned: false,
    attached_pull_request_id: null,
    ...overrides,
  };
}

async function render(value: PullRequestCandidate): Promise<HTMLElement> {
  const rendered = await mountWithQuery(<PullRequestCandidateRow issueId="i1" candidate={value} />);
  mounted.push(rendered);
  return rendered.container;
}

it("shows the proof, the author and the provenance as three separate facts", async () => {
  const container = await render(candidate());
  const paragraphs = [...container.querySelectorAll("p")].map((p) => p.textContent);

  expect(container.textContent).toContain("Candidate #18 on contrib/anti-slop");
  expect(container.textContent).toContain("External");
  expect(paragraphs).toContain(
    "@contrib · @contrib opened it on contrib/anti-slop, a branch Otomat does not own.",
  );
  expect(paragraphs).toContain("Names OTO-119 in its description: “Refs OTO-119”");
});

it("says the owner is unverified rather than blaming a missing author", async () => {
  const container = await render(
    candidate({ provenance: "unknown", evidence: { ...candidate().evidence, author_login: null } }),
  );
  const text = container.textContent ?? "";

  expect(text).toContain("Owner unverified");
  expect(text).toContain("Author unknown");
});

it("attaches a pull request this issue's workspace published on a single confirmation-free click", async () => {
  await render(candidate({ workspace_owned: true, provenance: "otomat" }));

  await act(async () => {
    findButton("Attach #18")?.click();
  });

  expect(attachPullRequest).toHaveBeenCalledWith("i1", { reference: "18" });
});

it("asks before adopting a pull request no run here owns, then closes on the confirmation", async () => {
  await render(candidate());

  await act(async () => {
    findButton("Attach #18…")?.click();
  });
  expect(attachPullRequest).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Pull request #18 found — attach it to OTO-119?");

  await act(async () => {
    findButton("Attach #18")?.click();
  });

  expect(attachPullRequest).toHaveBeenCalledWith("i1", { reference: "18" });
  expect(document.body.textContent).not.toContain("found — attach it to");
});

it("attaches nothing when the confirmation is cancelled", async () => {
  await render(candidate());

  await act(async () => {
    findButton("Attach #18…")?.click();
  });
  expect(document.body.textContent).toContain("found — attach it to");

  await act(async () => {
    findButton("Cancel")?.click();
  });

  expect(attachPullRequest).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain("found — attach it to");
});

it("shows the refusal a rejected attachment came back with instead of failing silently", async () => {
  attachPullRequest.mockRejectedValueOnce(
    new DaemonRequestError(409, "POST", "/api/issues/i1/pull-requests", {
      error: "pr_repository_mismatch",
      message: "#18 lives in another repository than this issue's workspace.",
    }),
  );
  const container = await render(candidate());

  await act(async () => {
    findButton("Attach #18…")?.click();
  });
  await act(async () => {
    findButton("Attach #18")?.click();
  });

  expect(container.querySelector("[role='alert']")?.textContent).toBe(
    "#18 lives in another repository than this issue's workspace.",
  );
  expect(document.body.textContent).not.toContain("found — attach it to");

  await act(async () => {
    findButton("Attach #18…")?.click();
  });

  expect(container.querySelector("[role='alert']")).toBeNull();
});
